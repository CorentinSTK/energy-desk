"""web.series_snapshot (migration 006): latest value, move z-score, percentile, seasonal gap."""

from datetime import UTC, date, datetime, timedelta

import psycopg
import pytest

from tests.db.test_schema import insert_series
from tests.db.test_seasonal import insert_values

COLUMNS = (
    "last_value, prev_value, move_z, move_count, percentile_5y, history_count,"
    " seasonal_mean, seasonal_years, seasonal_deviation_pct"
)


def snapshot(conn: psycopg.Connection, code: str) -> dict[str, object]:
    row = conn.execute(
        f"select {COLUMNS} from web.series_snapshot(%s) where code = %s", ([code], code)
    ).fetchone()
    assert row is not None
    return dict(zip([c.strip() for c in COLUMNS.split(",")], row, strict=True))


def test_move_z_compares_the_latest_change_with_the_past_year(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn, code="test.z")
    start = date(2026, 1, 1)
    # Alternating +1 / -1 changes for 60 days (standard deviation ~1), then a jump of +5.
    values = {start + timedelta(days=i): float(i % 2) for i in range(60)}
    values[start + timedelta(days=60)] = values[start + timedelta(days=59)] + 5
    insert_values(conn, series_id, values)
    snap = snapshot(conn, "test.z")
    assert snap["move_count"] == 59
    assert snap["move_z"] == pytest.approx(5 / 1.0085, rel=1e-3)


def test_move_z_needs_twenty_earlier_changes(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn, code="test.short")
    insert_values(conn, series_id, {date(2026, 1, d): float(d % 2) for d in range(1, 11)})
    assert snapshot(conn, "test.short")["move_z"] is None


def test_percentile_uses_the_last_five_years_only(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn, code="test.pct")
    # 2019 is more than five years before the latest value (2026): left out.
    insert_values(
        conn,
        series_id,
        {
            date(2019, 6, 1): 100.0,
            date(2022, 6, 1): 1.0,
            date(2024, 6, 1): 3.0,
            date(2026, 6, 1): 2.0,
        },
    )
    snap = snapshot(conn, "test.pct")
    assert snap["history_count"] == 3
    assert snap["percentile_5y"] == pytest.approx(200 / 3)  # 1 and 2 are at or below 2


def test_seasonal_gap_uses_the_same_day_of_the_five_prior_years(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn, code="test.season")
    values = {date(y, 10, 28): 80.0 + 2 * (y - 2021) for y in range(2020, 2026)}  # 2020 is out
    values[date(2026, 10, 28)] = 75.0
    insert_values(conn, series_id, values)
    snap = snapshot(conn, "test.season")
    assert snap["seasonal_years"] == 5
    assert snap["seasonal_mean"] == pytest.approx(84.0)  # mean of 80, 82, 84, 86, 88
    assert snap["seasonal_deviation_pct"] == pytest.approx((75 - 84) / 84 * 100)


def test_weekly_series_compare_iso_weeks(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn, code="test.week", frequency="weekly")
    fridays = {date.fromisocalendar(y, 43, 5): 400.0 + y - 2021 for y in range(2021, 2026)}
    fridays[date.fromisocalendar(2026, 43, 5)] = 410.0
    insert_values(conn, series_id, fridays)
    snap = snapshot(conn, "test.week")
    assert snap["seasonal_years"] == 5
    assert snap["seasonal_mean"] == pytest.approx(402.0)


def test_intraday_series_have_no_seasonal_measure(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn, code="test.hourly", frequency="hourly")
    start = datetime(2025, 10, 28, tzinfo=UTC)
    with conn.cursor() as cur:
        cur.executemany(
            "insert into market.observations (series_id, ts, value) values (%s, %s, 1)",
            [(series_id, start), (series_id, start + timedelta(days=365))],
        )
    snap = snapshot(conn, "test.hourly")
    assert snap["seasonal_years"] == 0
    assert snap["seasonal_deviation_pct"] is None


def test_series_without_observations_are_left_out(conn: psycopg.Connection) -> None:
    insert_series(conn, code="test.empty")
    rows = conn.execute("select code from web.series_snapshot(array['test.empty'])").fetchall()
    assert rows == []


def test_web_reader_can_call_it(conn: psycopg.Connection) -> None:
    series_id = insert_series(conn, code="test.reader")
    insert_values(conn, series_id, {date(2026, 1, 1): 1.0})
    conn.execute("set local role web_reader")
    assert snapshot(conn, "test.reader")["last_value"] == 1.0
