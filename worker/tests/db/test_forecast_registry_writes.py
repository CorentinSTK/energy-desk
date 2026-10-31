"""Live forecasts are stamped with the real time they were made, once per model and day."""

from datetime import UTC, date, datetime

import psycopg
import pytest

from tests.db.test_schema import insert_series
from worker.forecast import registry
from worker.forecast.__main__ import parse_args
from worker.forecast.core import Forecast
from worker.forecast.models.eu_storage import EuStorage30d


@pytest.fixture
def model(conn: psycopg.Connection) -> EuStorage30d:
    insert_series(conn, code="agsi.eu.full")
    m = EuStorage30d()
    registry.sync_model(conn, m)
    return m


def test_live_forecasts_keep_the_real_issue_time(
    conn: psycopg.Connection, model: EuStorage30d
) -> None:
    made = datetime(2026, 10, 31, 1, 44, 28, tzinfo=UTC)  # a scheduled job started late
    forecast = Forecast(date(2026, 10, 31), date(2026, 11, 28), 30, 69.9, {"naive": 74.9})
    assert not registry.issued_live_on(conn, model, date(2026, 10, 31))
    registry.insert_live(conn, model, [forecast], issued_at=made)
    row = conn.execute("select issued_at from market.forecasts where kind = 'live'").fetchone()
    assert row == (made,)
    assert registry.issued_live_on(conn, model, date(2026, 10, 31))
    assert not registry.issued_live_on(conn, model, date(2026, 11, 1))


def test_backtests_are_stamped_at_midnight_of_their_simulated_date(
    conn: psycopg.Connection, model: EuStorage30d
) -> None:
    registry.replace_backtest(
        conn, model, [Forecast(date(2022, 3, 1), date(2022, 3, 30), 30, 50.0, {})]
    )
    row = conn.execute("select issued_at from market.forecasts").fetchone()
    assert row == (datetime(2022, 3, 1, tzinfo=UTC),)


def test_a_past_issue_date_cannot_be_written_live() -> None:
    with pytest.raises(SystemExit):
        parse_args(["--model", "all", "--issue", "--date", "2026-10-30"])
    assert parse_args(["--model", "all", "--issue", "--date", "2026-10-30", "--dry-run"]).dry_run
