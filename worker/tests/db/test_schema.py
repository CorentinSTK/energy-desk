"""Constraints, access rights and the /data views, checked against a real Postgres."""

from datetime import UTC, datetime, timedelta

import psycopg
import pytest

SERIES = {
    "code": "test.daily",
    "name": "Test daily series",
    "commodity": "crude",
    "region": "US",
    "unit": "$/bbl",
    "frequency": "daily",
    "source": "test",
    "source_ref": "TEST",
    "license": "Public domain",
}


def insert_series(conn: psycopg.Connection, **overrides: object) -> int:
    row = {**SERIES, **overrides}
    columns = ", ".join(row)
    placeholders = ", ".join(f"%({k})s" for k in row)
    result = conn.execute(
        f"insert into market.series ({columns}) values ({placeholders}) returning id",
        row,
    ).fetchone()
    assert result is not None
    return int(result[0])


def insert_observations(conn: psycopg.Connection, series_id: int, days: list[int]) -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    with conn.cursor() as cur:
        cur.executemany(
            "insert into market.observations (series_id, ts, value) values (%s, %s, %s)",
            [(series_id, start + timedelta(days=d), 70.0 + d) for d in days],
        )


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_values_are_rejected(conn: psycopg.Connection, bad: str) -> None:
    series_id = insert_series(conn)
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "insert into market.observations (series_id, ts, value) values (%s, now(), %s::float8)",
            (series_id, bad),
        )


def test_unknown_frequency_and_price_kind_are_rejected(conn: psycopg.Connection) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        insert_series(conn, frequency="yearly")


def test_price_kind_must_be_known(conn: psycopg.Connection) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        insert_series(conn, price_kind="paper")


def test_duplicate_observation_is_rejected(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn)
    insert_observations(conn, series_id, [0])
    with pytest.raises(psycopg.errors.UniqueViolation):
        insert_observations(conn, series_id, [0])


def test_catalog_reports_coverage_and_gaps(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn)
    # Days 0-4, an Easter-sized jump (5 days: not a gap), then a 10-day hole (a gap).
    insert_observations(conn, series_id, [0, 1, 2, 3, 4, 9, 19, 20])
    row = conn.execute(
        "select observation_count, gap_count, largest_interval_days, last_observation"
        " from web.series_catalog where code = %s",
        (SERIES["code"],),
    ).fetchone()
    assert row is not None
    count, gaps, largest, last = row
    assert count == 8
    assert gaps == 1
    assert largest == pytest.approx(10.0)
    assert last == datetime(2026, 1, 21, tzinfo=UTC)


@pytest.mark.parametrize(
    ("frequency", "step", "hole_steps"),
    [("hourly", timedelta(hours=1), 2), ("half_hourly", timedelta(minutes=30), 2)],
)
def test_intraday_gaps_of_a_few_periods_are_reported(
    conn: psycopg.Connection, frequency: str, step: timedelta, hole_steps: int
) -> None:
    series_id = insert_series(conn, code=f"test.{frequency}", frequency=frequency)
    start = datetime(2026, 3, 29, tzinfo=UTC)  # spans the CET clock change: UTC has no hole
    steps = [*range(10), 10 + hole_steps, 11 + hole_steps]
    with conn.cursor() as cur:
        cur.executemany(
            "insert into market.observations (series_id, ts, value) values (%s, %s, 50)",
            [(series_id, start + step * i) for i in steps],
        )
    row = conn.execute(
        "select gap_count from web.series_catalog where code = %s", (f"test.{frequency}",)
    ).fetchone()
    assert row == (1,)


def test_series_threshold_overrides_the_frequency_default(conn: psycopg.Connection) -> None:
    # A calendar-day series (power): one missing day is a gap, where business-day series allow 5.
    series_id = insert_series(conn, code="test.every_day", gap_threshold_days=1)
    insert_observations(conn, series_id, [0, 1, 2, 4, 5])
    row = conn.execute(
        "select gap_count from web.series_catalog where code = 'test.every_day'"
    ).fetchone()
    assert row == (1,)


def test_catalog_lists_series_without_observations(conn: psycopg.Connection) -> None:
    insert_series(conn, code="test.empty")
    row = conn.execute(
        "select observation_count, last_observation from web.series_catalog"
        " where code = 'test.empty'"
    ).fetchone()
    assert row == (0, None)


def test_web_reader_can_read_views_only(conn: psycopg.Connection) -> None:
    insert_series(conn)
    conn.execute("set local role web_reader")
    assert conn.execute("select count(*) from web.series_catalog").fetchone() == (1,)
    conn.execute("select count(*) from web.ingest_runs_recent").fetchone()
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("select * from market.observations")


def test_web_reader_cannot_write(conn: psycopg.Connection) -> None:
    conn.execute("set local role web_reader")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("insert into market.ingest_runs (source, status) values ('x', 'ok')")


@pytest.mark.parametrize("role", ["anon", "authenticated"])
def test_supabase_api_roles_see_nothing(conn: psycopg.Connection, role: str) -> None:
    conn.execute(f"set local role {role}")
    for relation in ("market.series", "market.observations", "web.series_catalog"):
        with pytest.raises(psycopg.errors.InsufficientPrivilege), conn.transaction():
            conn.execute(f"select 1 from {relation} limit 1")


def test_rls_is_enabled_on_every_market_table(conn: psycopg.Connection) -> None:
    rows = conn.execute(
        "select relname, relrowsecurity from pg_class c"
        " join pg_namespace n on n.oid = c.relnamespace"
        " where n.nspname = 'market' and c.relkind = 'r'"
    ).fetchall()
    assert rows
    assert all(enabled for _, enabled in rows), rows
