"""web.seasonal_weekly (migration 005): same ISO week over the five prior years."""

from datetime import date

import psycopg
import pytest

from tests.db.test_schema import insert_series
from tests.db.test_seasonal import insert_values

CODE = "test.weekly"


def friday(year: int, week: int) -> date:
    """EIA weeks end on Friday."""
    return date.fromisocalendar(year, week, 5)


def weekly_row(conn: psycopg.Connection, week: int, year: int) -> tuple[object, ...]:
    row = conn.execute(
        "select min_value, max_value, mean_value, years_count, current_value"
        " from web.seasonal_weekly(%s, %s) where day = %s",
        (CODE, year, date.fromisocalendar(2001, week, 1)),
    ).fetchone()
    assert row is not None
    return tuple(row)


@pytest.fixture
def series_id(conn: psycopg.Connection) -> int:
    return insert_series(conn, code=CODE, frequency="weekly")


def test_norm_uses_the_same_week_of_the_five_prior_years(
    conn: psycopg.Connection, series_id: int
) -> None:
    # 2020 is six years back and 2026 is the current year: both stay out of the norm.
    insert_values(conn, series_id, {friday(y, 43): float(y - 2020) for y in range(2020, 2027)})
    assert weekly_row(conn, 43, 2026) == (1.0, 5.0, 3.0, 5, 6.0)
    assert conn.execute(
        "select count(*) from web.seasonal_weekly(%s, 2026)", (CODE,)
    ).fetchone() == (52,)


def test_week_53_folds_into_52_keeping_the_later_value(
    conn: psycopg.Connection, series_id: int
) -> None:
    # 2020 had an ISO week 53, ending on Friday 1 January 2021: it still belongs to ISO year 2020.
    assert friday(2020, 53) == date(2021, 1, 1)
    insert_values(conn, series_id, {friday(2020, 52): 1.0, friday(2020, 53): 2.0})
    assert weekly_row(conn, 52, 2025) == (2.0, 2.0, 2.0, 1, None)
    assert weekly_row(conn, 1, 2025)[3] == 0  # 1 January 2021 is not week 1 of 2021


def test_web_reader_can_use_weekly_seasonal(conn: psycopg.Connection, series_id: int) -> None:
    insert_values(conn, series_id, {friday(2025, 10): 1.0})
    conn.execute("set local role web_reader")
    assert weekly_row(conn, 10, 2026)[:4] == (1.0, 1.0, 1.0, 1)
