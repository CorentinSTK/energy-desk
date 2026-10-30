"""What every forecast model provides, the forecast record, and empirical 90% intervals."""

from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import numpy as np

from worker.forecast.data import History

# Intervals need this many past errors for the same horizon; with fewer, no interval is given.
MIN_ERRORS_FOR_INTERVAL = 50
INTERVAL_QUANTILES = (0.05, 0.95)


@dataclass(frozen=True)
class Forecast:
    """One forecast of the target series at `target`, issued on `issued`."""

    issued: date
    target: date
    horizon: int
    point: float
    baselines: Mapping[str, float | None]
    inputs: Mapping[str, Any] = field(default_factory=dict)
    lo90: float | None = None
    hi90: float | None = None


class Model(ABC):
    id: str
    name: str
    target_code: str
    horizon_unit: str  # "day" or "week"
    version: str
    description: str
    #: Every series the model reads.
    inputs: Sequence[str]

    @abstractmethod
    def cutoffs(self, issued: date) -> dict[str, date]:
        """Last observation date of each input that was published when issuing on `issued`."""

    @abstractmethod
    def forecast(self, history: History, issued: date) -> list[Forecast]:
        """Forecasts made on `issued` from `history`, which only holds what was known then."""

    def issue_dates(self, start: date, end: date) -> list[date]:
        """Dates on which the model issues forecasts (daily unless overridden)."""
        from worker.forecast.data import days

        return days(start, end)


def with_interval(forecast: Forecast, errors: Sequence[float]) -> Forecast:
    """Add the 5% and 95% quantiles of past errors (realised - point) for the same horizon.

    Empirical intervals: no assumption that errors are normal. The interval is widened to include
    the point if all past errors had the same sign. Without enough past errors the
    forecast has no interval rather than a guessed one.
    """
    if len(errors) < MIN_ERRORS_FOR_INTERVAL:
        return forecast
    low, high = np.quantile(np.asarray(errors, dtype=float), INTERVAL_QUANTILES)
    return Forecast(
        issued=forecast.issued,
        target=forecast.target,
        horizon=forecast.horizon,
        point=forecast.point,
        baselines=forecast.baselines,
        inputs=forecast.inputs,
        lo90=forecast.point + min(float(low), 0.0),
        hi90=forecast.point + max(float(high), 0.0),
    )
