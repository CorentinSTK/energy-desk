"""EU gas storage filling level 30 days ahead (GIE AGSI+).

Method, in two sentences: start from today's level and add the change seen over the same 30 calendar
days in the five previous years (the seasonal trajectory). Then correct for how fast storage has
been filling or emptying over the last 14 days compared with the same 14 days in those years, with a
weight learned from past issue dates (least squares, expanding window).

Baselines: "naive" = today's level (no change); "seasonal" = today's level + the seasonal change.
Issued daily after the evening AGSI+ update, when gas day D-1 is published.
"""

from datetime import date, timedelta

import numpy as np

from worker.forecast.core import Forecast, Model
from worker.forecast.data import History, Series, same_day_in_prior_years

TARGET = "agsi.eu.full"
HORIZON_DAYS = 30
PACE_DAYS = 14
YEARS = 5
MIN_PRIOR_YEARS = 3
# The pace weight is learned on past issue dates spaced by this many days (independent-ish samples).
FIT_SPACING_DAYS = 7
MIN_FIT_SAMPLES = 30


def seasonal_change(series: Series, start: date, days: int) -> float | None:
    """Mean change from `start` to `start + days` over the same dates of prior years."""
    changes = []
    for past in same_day_in_prior_years(start, YEARS):
        a = series.get(past)
        b = series.get(past + timedelta(days=days))
        if a is not None and b is not None:
            changes.append(b - a)
    return float(np.mean(changes)) if len(changes) >= MIN_PRIOR_YEARS else None


def pace_gap(series: Series, last: date) -> float | None:
    """Last 14 days' change minus the seasonal 14-day change, scaled to 30 days."""
    now, before = series.get(last), series.get(last - timedelta(days=PACE_DAYS))
    normal = seasonal_change(series, last - timedelta(days=PACE_DAYS), PACE_DAYS)
    if now is None or before is None or normal is None:
        return None
    return (now - before - normal) * HORIZON_DAYS / PACE_DAYS


class EuStorage30d(Model):
    id = "eu_storage_30d"
    name = "EU gas storage in 30 days"
    target_code = TARGET
    horizon_unit = "day"
    version = "1"
    description = (
        "EU storage filling level 30 days ahead: today's level plus the seasonal 30-day change of "
        "the five previous years, corrected for the recent filling pace."
    )
    inputs = (TARGET,)

    def cutoffs(self, issued: date) -> dict[str, date]:
        # Issued in the evening of `issued`, after AGSI+ publishes gas day issued - 1.
        return {TARGET: issued - timedelta(days=1)}

    def _pace_weight(self, series: Series, last: date) -> float:
        """Least-squares weight of the pace gap, on past starts whose 30-day outcome is known."""
        xs, ys = [], []
        start = last - timedelta(days=HORIZON_DAYS)
        while start >= series.dates[0] + timedelta(days=YEARS * 365):
            gap = pace_gap(series, start)
            normal = seasonal_change(series, start, HORIZON_DAYS)
            a, b = series.get(start), series.get(start + timedelta(days=HORIZON_DAYS))
            if gap is not None and normal is not None and a is not None and b is not None:
                xs.append(gap)
                ys.append(b - a - normal)
            start -= timedelta(days=FIT_SPACING_DAYS)
        if len(xs) < MIN_FIT_SAMPLES:
            return 0.0
        x, y = np.asarray(xs), np.asarray(ys)
        denominator = float(x @ x)
        return float(x @ y) / denominator if denominator > 0 else 0.0

    def forecast(self, history: History, issued: date) -> list[Forecast]:
        series = history[TARGET]
        last_point = series.last()
        if last_point is None:
            return []
        last, level = last_point
        normal = seasonal_change(series, last, HORIZON_DAYS)
        if normal is None:
            return []
        gap = pace_gap(series, last)
        weight = self._pace_weight(series, last)
        point = level + normal + (weight * gap if gap is not None else 0.0)
        return [
            Forecast(
                issued=issued,
                target=last + timedelta(days=HORIZON_DAYS),
                horizon=HORIZON_DAYS,
                point=point,
                baselines={"naive": level, "seasonal": level + normal},
                inputs={
                    "last_date": last.isoformat(),
                    "last_level": level,
                    "seasonal_change": normal,
                    "pace_gap": gap,
                    "pace_weight": weight,
                },
            )
        ]
