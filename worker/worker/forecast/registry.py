"""Reading inputs from and writing forecasts to the database (migration 007)."""

import json
from collections.abc import Iterable, Sequence
from datetime import UTC, date, datetime, time

import psycopg

from worker.forecast.core import Forecast, Model
from worker.forecast.data import History, Series


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


def _row(
    model: Model, kind: str, f: Forecast, issued_at: datetime | None = None
) -> tuple[object, ...]:
    """Backtests are stamped at midnight of their simulated issue date; live forecasts at the real
    time they were made (`issued_at`)."""
    return (
        model.id,
        model.version,
        kind,
        issued_at or _timestamp(f.issued),
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


def issued_live_on(conn: psycopg.Connection, model: Model, day: date) -> bool:
    """Whether this model version already issued live forecasts on `day` (UTC)."""
    row = conn.execute(
        "select exists (select 1 from market.forecasts where model_id = %s and version = %s"
        " and kind = 'live' and (issued_at at time zone 'UTC')::date = %s)",
        (model.id, model.version, day),
    ).fetchone()
    return bool(row and row[0])


def insert_live(
    conn: psycopg.Connection, model: Model, forecasts: Sequence[Forecast], issued_at: datetime
) -> int:
    """Store live forecasts with the real time they were made. One issue per model and day: the
    caller checks `issued_live_on` first, so a re-run never adds a second set."""
    with conn.cursor() as cur:
        cur.executemany(INSERT, [_row(model, "live", f, issued_at) for f in forecasts])
        return len(forecasts)


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
