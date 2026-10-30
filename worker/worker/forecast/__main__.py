"""Forecast registry command line (M6).

    uv run python -m worker.forecast --model all --backtest --since 2019-01-01  # walk-forward
    uv run python -m worker.forecast --model all --issue                        # live, today
    uv run python -m worker.forecast --model eu_storage_30d --issue --dry-run   # print only

Live forecasts are written once and never changed (migration 007). Backtests replace the stored
backtest of the same model version.
"""

import argparse
import sys
from collections.abc import Sequence
from datetime import UTC, date, datetime

import psycopg

from worker.config import get_settings, require
from worker.forecast import registry
from worker.forecast.backtest import backtest
from worker.forecast.core import Forecast, Model, with_interval
from worker.forecast.data import History
from worker.forecast.live_inputs import fetch_holidays, forecast_weather
from worker.forecast.metrics import score
from worker.forecast.models.eu_storage import EuStorage30d
from worker.forecast.models.fr_power import FrPowerDemand, observed_weather
from worker.forecast.models.us_crude import UsCrudeStocks
from worker.http_client import make_client

MODEL_CLASSES: dict[str, type[Model]] = {
    "eu_storage_30d": EuStorage30d,
    "fr_power_demand": FrPowerDemand,
    "us_crude_stocks": UsCrudeStocks,
}


def build_models(ids: Sequence[str], history: History, live: bool) -> list[Model]:
    """Instantiate models; the French demand model needs holidays and target-day weather."""
    models: list[Model] = []
    with make_client() as client:
        for model_id in ids:
            if model_id == "fr_power_demand":
                weather = forecast_weather(client) if live else observed_weather(history)
                models.append(FrPowerDemand(fetch_holidays(client), weather))
            else:
                models.append(MODEL_CLASSES[model_id]())
    return models


def print_forecasts(model: Model, forecasts: Sequence[Forecast]) -> None:
    for f in forecasts[-10:]:
        interval = f"[{f.lo90:.2f}, {f.hi90:.2f}]" if f.lo90 is not None else "(no interval)"
        print(
            f"  {model.id} issued {f.issued} → {f.target} (h={f.horizon}): {f.point:.2f} {interval}"
            f" baselines {dict(f.baselines)}"
        )


def run(args: argparse.Namespace) -> int:
    ids = list(MODEL_CLASSES) if args.model == "all" else [args.model]
    url = require(get_settings().database_url, "DATABASE_URL")
    with psycopg.connect(url) as conn:
        codes = {code for model_id in ids for code in MODEL_CLASSES[model_id].inputs}
        history = registry.load_history(conn, codes)
        for model in build_models(ids, history, live=not args.backtest):
            if not args.dry_run:
                registry.sync_model(conn, model)
            if args.backtest:
                forecasts = run_backtest(model, history, args.since, args.until)
                if not args.dry_run:
                    registry.replace_backtest(conn, model, forecasts)
            else:
                forecasts = issue(conn, model, history, args.date or datetime.now(UTC).date())
                if not args.dry_run:
                    registry.insert_live(conn, model, forecasts)
            print_forecasts(model, forecasts)
            if not args.dry_run:
                conn.commit()
    return 0


def run_backtest(model: Model, history: History, since: date, until: date | None) -> list[Forecast]:
    end = until or datetime.now(UTC).date()
    forecasts = backtest(model, history, since, end)
    print(f"[{model.id} v{model.version}] backtest {since} → {end}: {len(forecasts)} forecasts")
    summary = score(forecasts, dict(history[model.target_code].as_dict()))
    if summary:
        print(
            f"  scored {summary.n}: MAE {summary.mae:.3f}, RMSE {summary.rmse:.3f},"
            f" bias {summary.bias:+.3f}, skill vs naive {summary.skill['naive']},"
            f" vs seasonal {summary.skill['seasonal']}, 90% coverage {summary.coverage90}"
        )
    return forecasts


def issue(conn: psycopg.Connection, model: Model, history: History, issued: date) -> list[Forecast]:
    """Live forecasts for `issued`, with intervals from this version's backtest errors."""
    if issued not in model.issue_dates(issued, issued):
        print(f"[{model.id} v{model.version}] {issued} is not an issue day: nothing issued")
        return []
    vintage = history.as_of(model.cutoffs(issued))
    errors = registry.backtest_errors(conn, model)
    published = history[model.target_code].as_dict()
    forecasts = [
        with_interval(f, errors.get(f.horizon, []))
        for f in model.forecast(vintage, issued)
        if f.target not in published  # never forecast a known outcome
    ]
    print(f"[{model.id} v{model.version}] issued {issued}: {len(forecasts)} forecasts")
    return forecasts


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="worker.forecast", description=__doc__.splitlines()[0])
    parser.add_argument("--model", required=True, choices=[*MODEL_CLASSES, "all"])
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--issue", action="store_true", help="issue live forecasts")
    mode.add_argument("--backtest", action="store_true", help="run the walk-forward backtest")
    parser.add_argument("--date", type=date.fromisoformat, help="issue date (default: today, UTC)")
    parser.add_argument("--since", type=date.fromisoformat, default=date(2019, 1, 1))
    parser.add_argument("--until", type=date.fromisoformat)
    parser.add_argument("--dry-run", action="store_true", help="print, write nothing")
    return parser.parse_args(argv)


if __name__ == "__main__":
    sys.exit(run(parse_args()))
