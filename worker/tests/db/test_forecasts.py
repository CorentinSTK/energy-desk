"""Forecast registry (migration 007): immutability, scoring against realised values, access."""

import json
from datetime import UTC, date, datetime

import psycopg
import pytest

from tests.db.test_schema import insert_series
from tests.db.test_seasonal import insert_values

CODE = "test.target"
DAY = datetime(2026, 10, 28, tzinfo=UTC)


@pytest.fixture
def model(conn: psycopg.Connection) -> str:
    insert_series(conn, code=CODE)
    conn.execute(
        "insert into market.forecast_models (id, name, target_code, horizon_unit)"
        " values ('test_model', 'Test model', %s, 'day')",
        (CODE,),
    )
    return "test_model"


def add(
    conn: psycopg.Connection,
    model: str,
    *,
    kind: str = "live",
    target: datetime = DAY,
    point: float = 10.0,
    interval: tuple[float, float] | None = (8.0, 12.0),
    baselines: dict[str, float] | None = None,
) -> int:
    row = conn.execute(
        "insert into market.forecasts"
        " (model_id, version, kind, issued_at, target_ts, horizon, point, lo90, hi90, baselines)"
        " values (%s, 'v1', %s, %s, %s, 1, %s, %s, %s, %s) returning id",
        (
            model,
            kind,
            target.replace(day=target.day - 1),
            target,
            point,
            interval[0] if interval else None,
            interval[1] if interval else None,
            json.dumps(baselines or {}),
        ),
    ).fetchone()
    assert row is not None
    return int(row[0])


def test_live_forecasts_cannot_be_changed_or_deleted(conn: psycopg.Connection, model: str) -> None:
    forecast = add(conn, model)
    with pytest.raises(psycopg.errors.RestrictViolation), conn.transaction():
        conn.execute("update market.forecasts set point = 11 where id = %s", (forecast,))
    with pytest.raises(psycopg.errors.RestrictViolation), conn.transaction():
        conn.execute("delete from market.forecasts where id = %s", (forecast,))


def test_backtests_can_be_replaced(conn: psycopg.Connection, model: str) -> None:
    forecast = add(conn, model, kind="backtest")
    conn.execute("delete from market.forecasts where id = %s", (forecast,))
    assert conn.execute("select count(*) from market.forecasts").fetchone() == (0,)


def test_live_forecast_of_a_published_outcome_is_refused(
    conn: psycopg.Connection, model: str
) -> None:
    series_id = conn.execute("select id from market.series where code = %s", (CODE,)).fetchone()
    assert series_id is not None
    insert_values(conn, series_id[0], {date(2026, 10, 28): 10.0})
    with pytest.raises(psycopg.errors.RestrictViolation), conn.transaction():
        add(conn, model, target=DAY)
    add(conn, model, kind="backtest", target=DAY)  # backtests are made after the fact by design


def test_interval_must_contain_the_point(conn: psycopg.Connection, model: str) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        add(conn, model, point=20.0, interval=(8.0, 12.0))


def test_scores_follow_the_realised_value(conn: psycopg.Connection, model: str) -> None:
    targets = [datetime(2026, 10, d, tzinfo=UTC) for d in (26, 27, 28)]
    for target, point in zip(targets, (10.0, 12.0, 9.0), strict=True):
        add(conn, model, target=target, point=point, baselines={"naive": 7.0, "seasonal": 10.0})
    # Outcomes are published after the forecasts were stored.
    # Realised 10, 10, 13: model errors 0, 2, 4; naive errors 3, 3, 6; seasonal errors 0, 0, 3.
    series_id = conn.execute("select id from market.series where code = %s", (CODE,)).fetchone()
    assert series_id is not None
    insert_values(
        conn,
        series_id[0],
        {date(2026, 10, 26): 10.0, date(2026, 10, 27): 10.0, date(2026, 10, 28): 13.0},
    )
    row = conn.execute(
        "select n, mae, bias, mae_naive, skill_naive, mae_seasonal, skill_seasonal, coverage90"
        " from web.forecast_scores where model_id = %s and kind = 'live'",
        (model,),
    ).fetchone()
    assert row is not None
    n, mae, bias, mae_naive, skill_naive, mae_seasonal, skill_seasonal, coverage = row
    assert n == 3
    assert mae == pytest.approx(2.0)
    assert bias == pytest.approx(-2 / 3)  # (0 + 2 - 4) / 3
    assert mae_naive == pytest.approx(4.0)
    assert skill_naive == pytest.approx(0.5)
    assert mae_seasonal == pytest.approx(1.0)
    assert skill_seasonal == pytest.approx(-1.0)  # worse than the seasonal baseline
    assert coverage == pytest.approx(2 / 3)  # 13 is outside [8, 12]

    # A revised observation changes the score; the forecast itself is untouched.
    conn.execute(
        "update market.observations set value = 9 where series_id = %s and ts = %s",
        (series_id[0], targets[2]),
    )
    revised = conn.execute(
        "select mae from web.forecast_scores where model_id = %s", (model,)
    ).fetchone()
    assert revised is not None and revised[0] == pytest.approx(2 / 3)


def test_unpublished_targets_are_not_scored(conn: psycopg.Connection, model: str) -> None:
    add(conn, model)
    assert conn.execute("select count(*) from web.forecast_scores").fetchone() == (0,)
    assert conn.execute("select realised from web.forecasts").fetchone() == (None,)


def test_web_reader_reads_views_not_tables(conn: psycopg.Connection, model: str) -> None:
    add(conn, model)
    conn.execute("set local role web_reader")
    assert conn.execute("select count(*) from web.forecasts").fetchone() == (1,)
    assert conn.execute("select count(*) from web.forecast_models").fetchone() == (1,)
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("select * from market.forecasts")
