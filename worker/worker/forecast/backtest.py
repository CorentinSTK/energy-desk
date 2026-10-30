"""Walk-forward backtest: the model is run as if it had been live on every past issue date.

For each issue date the model gets the history cut at what was published then (`Model.cutoffs`), so
it is refitted on an expanding window and never sees the future. The 90% interval of each backtest
forecast uses only errors of earlier forecasts whose outcome was already published on that date.
"""

from collections import defaultdict
from datetime import date

from worker.forecast.core import Forecast, Model, with_interval
from worker.forecast.data import History


def backtest(model: Model, history: History, start: date, end: date) -> list[Forecast]:
    target = history[model.target_code]
    realised = target.as_dict()
    errors: dict[int, list[float]] = defaultdict(list)
    pending: list[Forecast] = []
    results: list[Forecast] = []
    for issued in model.issue_dates(start, end):
        cutoffs = model.cutoffs(issued)
        known_until = cutoffs[model.target_code]
        # Forecasts whose target was published by now become errors usable for intervals.
        still_pending = []
        for f in pending:
            if f.target <= known_until and f.target in realised:
                errors[f.horizon].append(realised[f.target] - f.point)
            elif f.target > known_until:
                still_pending.append(f)
        pending = still_pending
        for f in model.forecast(history.as_of(cutoffs), issued):
            results.append(with_interval(f, errors[f.horizon]))
            pending.append(f)
    return results
