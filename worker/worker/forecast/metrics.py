"""Forecast scores in Python, for backtest summaries printed by the CLI. The site reads the same
measures from web.forecast_scores (migration 007), which is the reference."""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import date

import numpy as np

from worker.forecast.core import Forecast


@dataclass(frozen=True)
class Score:
    n: int
    mae: float
    rmse: float
    bias: float
    skill: dict[str, float | None]
    coverage90: float | None


def score(forecasts: Sequence[Forecast], realised: Mapping[date, float]) -> Score | None:
    done = [f for f in forecasts if f.target in realised]
    if not done:
        return None
    errors = np.asarray([f.point - realised[f.target] for f in done])
    skill: dict[str, float | None] = {}
    for name in ("naive", "seasonal"):
        rows = [f for f in done if f.baselines.get(name) is not None]
        if not rows:
            skill[name] = None
            continue
        model_mae = float(np.mean([abs(f.point - realised[f.target]) for f in rows]))
        base_mae = float(
            np.mean([abs(float(f.baselines[name] or 0) - realised[f.target]) for f in rows])
        )
        skill[name] = 1 - model_mae / base_mae if base_mae > 0 else None
    with_interval = [f for f in done if f.lo90 is not None and f.hi90 is not None]
    coverage = (
        float(np.mean([f.lo90 <= realised[f.target] <= f.hi90 for f in with_interval]))  # type: ignore[operator]
        if with_interval
        else None
    )
    return Score(
        n=len(done),
        mae=float(np.mean(np.abs(errors))),
        rmse=float(np.sqrt(np.mean(errors**2))),
        bias=float(np.mean(errors)),
        skill=skill,
        coverage90=coverage,
    )
