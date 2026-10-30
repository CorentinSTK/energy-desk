"""Reading inputs from and writing forecasts to the database (migration 007)."""

import json
from collections.abc import Iterable, Sequence
from datetime import UTC, date, datetime, time

import psycopg

from worker.forecast.core import Forecast, Model
from worker.forecast.data import History, Series

# Live forecasts are stamped at this UTC time of the issue date (the workflow runs in the evening).
ISSUE_TIME = time(21, 0)


def load_history(conn: psycopg.Connection, codes: Iterable[str]) -> History:
    series: dict[str, Series] = {}
    for code in codes:
        rows = conn.execute(
            "select (o.ts at time zone 'UTC')::date, o.value from market.observations o"
            " join market.series s on s.id = o.series_id where s.code = %s order by o.ts",
            (code,),
        ).fetchall()
        series[code] = Series([r[0] for r in rows], [float(r[1]) for r in rows])
    return History(series)


def sync_model(conn: psycopg.Connection, model: Model) -> None:
    conn.execute(
        """
        insert into market.forecast_models (id, name, target_code, horizon_unit, description)
        values (%s, %s, %s, %s, %s)
        on conflict (id) do update set
            name = excluded.name, target_code = excluded.target_code,
            horizon_unit = excluded.horizon_unit, description = excluded.description
        """,
        (model.id, model.name, model.target_code, model.horizon_unit, model.description),
    )


def _timestamp(day: date, at: time = time(0, 0)) -> datetime:
    return datetime.combine(day, at, tzinfo=UTC)


def _row(model: Model, kind: str, f: Forecast) -> tuple[object, ...]:
    return (
        model.id,
        model.version,
        kind,
        _timestamp(f.issued, ISSUE_TIME if kind == "live" else time(0, 0)),
        _timestamp(f.target),
        f.horizon,
        f.point,
        f.lo90,
        f.hi90,
        json.dumps({k: v for k, v in f.baselines.items() if v is not None}),
        json.dumps(f.inputs),
    )


INSERT = """
    insert into market.forecasts (model_id, version, kind, issued_at, target_ts, horizon, point,
                                  lo90, hi90, baselines, inputs)
    values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    on conflict (model_id, version, kind, issued_at, target_ts) do nothing
"""


def replace_backtest(conn: psycopg.Connection, model: Model, forecasts: Sequence[Forecast]) -> int:
    """Store a model version's backtest, replacing any earlier backtest of that version."""
    conn.execute(
        "delete from market.forecasts where model_id = %s and version = %s and kind = 'backtest'",
        (model.id, model.version),
    )
    with conn.cursor() as cur:
        cur.executemany(INSERT, [_row(model, "backtest", f) for f in forecasts])
    return len(forecasts)


def insert_live(conn: psycopg.Connection, model: Model, forecasts: Sequence[Forecast]) -> int:
    """Store live forecasts. A forecast already issued for the same day and target is kept as is."""
    with conn.cursor() as cur:
        cur.executemany(INSERT, [_row(model, "live", f) for f in forecasts])
        return cur.rowcount if cur.rowcount >= 0 else len(forecasts)


def backtest_errors(conn: psycopg.Connection, model: Model) -> dict[int, list[float]]:
    """Errors (realised - point) of this version's backtest per horizon, for live intervals."""
    rows = conn.execute(
        "select horizon, realised - point from web.forecasts where model_id = %s and version = %s"
        " and kind = 'backtest' and realised is not null",
        (model.id, model.version),
    ).fetchall()
    errors: dict[int, list[float]] = {}
    for horizon, error in rows:
        errors.setdefault(int(horizon), []).append(float(error))
    return errors
