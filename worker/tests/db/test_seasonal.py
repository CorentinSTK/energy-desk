"""web.seasonal_daily and the visibility of raw futures data (migration 002)."""

from datetime import UTC, date, datetime

import psycopg
import pytest

from tests.db.test_schema import insert_series


def insert_values(conn: psycopg.Connection, series_id: int, values: dict[date, float]) -> None:
    with conn.cursor() as cur:
        cur.executemany(
            "insert into market.observations (series_id, ts, value) values (%s, %s, %s)",
            [
                (series_id, datetime(d.year, d.month, d.day, tzinfo=UTC), v)
                for d, v in values.items()
            ],
        )


def seasonal_row(conn: psycopg.Connection, day: date, year: int = 2026) -> tuple[object, ...]:
    row = conn.execute(
        "select min_value, max_value, mean_value, years_count, current_value"
        " from web.seasonal_daily('test.daily', %s) where day = %s",
        (year, day.replace(year=2001)),
    ).fetchone()
    assert row is not None
    return tuple(row)


@pytest.fixture
def series_id(conn: psycopg.Connection) -> int:
    return insert_series(conn)


def test_norm_uses_the_five_prior_years_only(conn: psycopg.Connection, series_id: int) -> None:
    # 2020 is outside the window (6 years back) and 2026 is the current year: both stay out.
    values = {date(y, 3, 1): float(y - 2020) for y in range(2020, 2027)}
    insert_values(conn, series_id, values)
    assert seasonal_row(conn, date(2026, 3, 1)) == (1.0, 5.0, 3.0, 5, 6.0)


def test_leap_years_align_on_month_and_day(conn: psycopg.Connection, series_id: int) -> None:
    # 2024 is a leap year: 1 March is day 61 there and day 60 elsewhere; it must still line up.
    insert_values(conn, series_id, {date(2024, 3, 1): 10.0, date(2025, 3, 1): 20.0})
    assert seasonal_row(conn, date(2026, 3, 1))[:4] == (10.0, 20.0, 15.0, 2)


def test_february_29_is_left_out(conn: psycopg.Connection, series_id: int) -> None:
    insert_values(conn, series_id, {date(2024, 2, 29): 99.0, date(2024, 2, 28): 1.0})
    days = conn.execute("select count(*) from web.seasonal_daily('test.daily', 2026)").fetchone()
    assert days == (365,)
    assert seasonal_row(conn, date(2026, 2, 28))[:2] == (1.0, 1.0)


def test_missing_years_are_counted_not_filled(conn: psycopg.Connection, series_id: int) -> None:
    insert_values(conn, series_id, {date(2023, 6, 1): 5.0})
    assert seasonal_row(conn, date(2026, 6, 1)) == (5.0, 5.0, 5.0, 1, None)
    assert seasonal_row(conn, date(2026, 6, 2)) == (None, None, None, 0, None)


def test_web_reader_can_use_seasonal_and_observations(
    conn: psycopg.Connection, series_id: int
) -> None:
    insert_values(conn, series_id, {date(2025, 1, 1): 1.0})
    conn.execute("set local role web_reader")
    assert conn.execute("select count(*) from web.observations").fetchone() == (1,)
    assert conn.execute(
        "select count(*) from web.seasonal_daily('test.daily', 2026)"
    ).fetchone() == (365,)


def test_web_reader_cannot_read_raw_futures(conn: psycopg.Connection) -> None:
    conn.execute(
        "insert into market.futures_contracts"
        " (contract, root, exchange, delivery_month, ts, settle, source)"
        " values ('TTFZ26.NYM', 'TTF', 'NYMEX', '2026-12-01', now(), 99.0, 'yahoo')"
    )
    conn.execute("set local role web_reader")
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("select * from market.futures_contracts")


def test_delivery_month_must_be_first_of_month(conn: psycopg.Connection) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "insert into market.futures_contracts"
            " (contract, root, exchange, delivery_month, ts, settle, source)"
            " values ('X', 'TTF', 'NYMEX', '2026-12-15', now(), 1.0, 'yahoo')"
        )
