"""US commercial crude stocks in the next EIA weekly report (WPSR).

Method, in two sentences: start from the seasonal change of US crude stocks for that week of the
year (the mean over the five previous years). Then correct it with a regression, fitted on all
earlier weeks, on what was already published when the forecast is made: the previous week's change
against its own seasonal norm, refinery utilisation against its seasonal norm, and crude net imports
against their four-week average.

Baselines: "naive" = the last published level (no change); "seasonal" = last level + seasonal
change. Issued on Tuesday for the week that ended the previous Friday, which EIA publishes on
Wednesday.
"""

from datetime import date, timedelta

import numpy as np

from worker.forecast.core import Forecast, Model
from worker.forecast.data import History, Series

STOCKS = "eia.us_crude_stocks"
UTILISATION = "eia.us_refinery_utilisation"
NET_IMPORTS = "eia.us_crude_net_imports"
YEARS = 5
MIN_PRIOR_YEARS = 3
MIN_TRAINING_WEEKS = 104
NET_IMPORT_WEEKS = 4
# Weekdays as date.weekday() counts them (Monday = 0); ISO counts Monday = 1.
TUESDAY = 1
# Weeks before this are not used for fitting (the window still expands from here).
TRAINING_START = date(2005, 1, 1)
FRIDAY = 4
ISO_FRIDAY = 5


def same_week_prior_years(day: date) -> list[date]:
    """Friday of the same ISO week (53 folded into 52) in each of the five previous ISO years."""
    iso = day.isocalendar()
    week = min(iso.week, 52)
    return [date.fromisocalendar(iso.year - back, week, ISO_FRIDAY) for back in range(1, YEARS + 1)]


def seasonal_change(stocks: Series, week_end: date) -> float | None:
    """Mean weekly change of the same ISO week over the five previous years."""
    changes = []
    for friday in same_week_prior_years(week_end):
        now, before = stocks.get(friday), stocks.get(friday - timedelta(days=7))
        if now is not None and before is not None:
            changes.append(now - before)
    return float(np.mean(changes)) if len(changes) >= MIN_PRIOR_YEARS else None


def seasonal_level(series: Series, week_end: date) -> float | None:
    values = [v for f in same_week_prior_years(week_end) if (v := series.get(f)) is not None]
    return float(np.mean(values)) if len(values) >= MIN_PRIOR_YEARS else None


def regressors(history: History, last: date) -> list[float] | None:
    """What was known after the report for week `last`: three deviations from normal."""
    stocks, util, imports = history[STOCKS], history[UTILISATION], history[NET_IMPORTS]
    level, previous = stocks.get(last), stocks.get(last - timedelta(days=7))
    normal_change = seasonal_change(stocks, last)
    utilisation, normal_util = util.get(last), seasonal_level(util, last)
    recent_imports = [imports.get(last - timedelta(days=7 * k)) for k in range(NET_IMPORT_WEEKS)]
    if (
        level is None
        or previous is None
        or normal_change is None
        or utilisation is None
        or normal_util is None
        or any(v is None for v in recent_imports)
    ):
        return None
    imports_now = recent_imports[0]
    assert imports_now is not None
    imports_mean = float(np.mean([v for v in recent_imports if v is not None]))
    return [level - previous - normal_change, utilisation - normal_util, imports_now - imports_mean]


class UsCrudeStocks(Model):
    id = "us_crude_stocks"
    name = "US crude stocks, next EIA report"
    target_code = STOCKS
    horizon_unit = "week"
    version = "1"
    description = (
        "US commercial crude stocks in the next weekly EIA report: the seasonal change for that "
        "week, corrected by a regression on the previous week's surprise, refinery runs and net "
        "imports."
    )
    inputs = (STOCKS, UTILISATION, NET_IMPORTS)

    def issue_dates(self, start: date, end: date) -> list[date]:
        first = start + timedelta(days=(TUESDAY - start.weekday()) % 7)
        return [first + timedelta(days=7 * k) for k in range((end - first).days // 7 + 1)]

    def cutoffs(self, issued: date) -> dict[str, date]:
        # On a Tuesday the latest report is last Wednesday's, for the week ending 11 days before.
        days_since_friday = (issued.weekday() - FRIDAY) % 7
        latest_published_friday = issued - timedelta(days=days_since_friday + 7)
        return {code: latest_published_friday for code in self.inputs}

    def forecast(self, history: History, issued: date) -> list[Forecast]:
        stocks = history[STOCKS]
        last_point = stocks.last()
        if last_point is None:
            return []
        last, level = last_point
        target = last + timedelta(days=7)
        normal = seasonal_change(stocks, target)
        x_now = regressors(history, last)
        if normal is None or x_now is None:
            return []

        xs, ys = [], []
        for week_end in stocks.dates:
            if week_end < TRAINING_START:
                continue
            if week_end > last:
                break
            x = regressors(history, week_end - timedelta(days=7))
            norm = seasonal_change(stocks, week_end)
            before = stocks.get(week_end - timedelta(days=7))
            now = stocks.get(week_end)
            if x is not None and norm is not None and before is not None and now is not None:
                xs.append(x)
                ys.append(now - before - norm)
        if len(ys) < MIN_TRAINING_WEEKS:
            return []
        coef, *_ = np.linalg.lstsq(np.asarray(xs), np.asarray(ys), rcond=None)
        correction = float(np.asarray(x_now) @ coef)
        return [
            Forecast(
                issued=issued,
                target=target,
                horizon=1,
                point=level + normal + correction,
                baselines={"naive": level, "seasonal": level + normal},
                inputs={
                    "last_date": last.isoformat(),
                    "last_level": level,
                    "seasonal_change": round(normal, 1),
                    "regressors": [round(v, 2) for v in x_now],
                    "coefficients": [round(float(c), 4) for c in coef],
                    "training_weeks": len(ys),
                },
            )
        ]
