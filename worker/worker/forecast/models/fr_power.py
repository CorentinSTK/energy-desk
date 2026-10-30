"""French daily power consumption, 1 to 7 days ahead (RTE éCO2mix via ODRÉ).

Method, in two sentences: French demand rises steeply when it is cold because of electric heating,
so the model is a linear regression of daily consumption on heating and cooling degree-days (from a
population-weighted temperature of eight cities), the day of the week, public holidays and the
month, fitted on the three years before the issue date. The forecast then adds the model's average
error of the last seven known days, which absorbs slow shifts in demand the weather does not
explain.

Horizons: 1 (tomorrow) to 7 days after the issue date. Baselines: "naive" = the latest known
consumption on the same weekday as the target (one or two weeks before it); "seasonal" = mean of the
same calendar day over the five previous years.

The temperature of the target days is the one input from after the issue date. Live forecasts use
the Open-Meteo weather forecast, read at issue time and stored in the forecast's inputs. Backtests
use the observed temperature instead (a perfect weather forecast), so backtest errors are smaller
than live errors will be: the forecast page says so.
"""

from collections.abc import Callable, Mapping
from datetime import date, timedelta

import numpy as np

from worker.forecast.core import Forecast, Model
from worker.forecast.data import History, Series, same_day_in_prior_years

TARGET = "odre.fr.load"
# Natural Earth populated places, `pop_max` (agglomeration population), read 2026-10-30.
CITY_WEIGHTS: Mapping[str, float] = {
    "paris": 9_904_000,
    "lyon": 1_423_000,
    "marseille": 1_400_000,
    "lille": 1_044_000,
    "nice": 927_000,
    "toulouse": 847_000,
    "bordeaux": 803_000,
    "rouen": 532_559,
}
TEMPERATURES = tuple(f"open_meteo.fr.{city}.tmean" for city in CITY_WEIGHTS)
HEATING_BASE = 15.0  # °C: below this, heating demand grows with the cold
COOLING_BASE = 18.0  # °C: above this, cooling demand grows with the heat
HORIZONS = range(1, 8)
TRAINING_DAYS = 3 * 365
RESIDUAL_DAYS = 7
SEASONAL_YEARS = 5
MIN_SEASONAL_YEARS = 3
MIN_TRAINING_DAYS = 365

# Temperature of target days: target dates → ({date: weighted °C}, label kept in the inputs).
WeatherForTargets = Callable[[list[date]], tuple[dict[date, float], str]]


def weighted_temperature(history: History, day: date) -> float | None:
    """Population-weighted mean temperature; None unless every city has a value that day."""
    total = 0.0
    for city, weight in CITY_WEIGHTS.items():
        value = history[f"open_meteo.fr.{city}.tmean"].get(day)
        if value is None:
            return None
        total += weight * value
    return total / sum(CITY_WEIGHTS.values())


def features(day: date, temperature: float, holidays: set[date]) -> list[float]:
    """Regressors of one day: intercept, degree-days, weekday, holiday, month (dummies)."""
    weekday = [1.0 if day.weekday() == k else 0.0 for k in range(1, 7)]  # Monday is the reference
    month = [1.0 if day.month == m else 0.0 for m in range(2, 13)]  # January is the reference
    return [
        1.0,
        max(0.0, HEATING_BASE - temperature),
        max(0.0, temperature - COOLING_BASE),
        *weekday,
        1.0 if day in holidays else 0.0,
        *month,
    ]


def same_weekday_known(series: Series, target: date, last: date) -> float | None:
    """Latest known value on the target's weekday: 7, 14… days before it, on or before `last`."""
    day = target - timedelta(days=7)
    while day > last:
        day -= timedelta(days=7)
    return series.get(day)


def seasonal_mean(series: Series, day: date) -> float | None:
    values = [
        v for d in same_day_in_prior_years(day, SEASONAL_YEARS) if (v := series.get(d)) is not None
    ]
    return float(np.mean(values)) if len(values) >= MIN_SEASONAL_YEARS else None


class FrPowerDemand(Model):
    id = "fr_power_demand"
    name = "France daily power demand"
    target_code = TARGET
    horizon_unit = "day"
    version = "1"
    description = (
        "French daily consumption 1 to 7 days ahead from a regression on population-weighted "
        "degree-days, weekday, holidays and month, corrected by the last week's average error."
    )
    inputs = (TARGET, *TEMPERATURES)

    def __init__(self, holidays: set[date], target_weather: WeatherForTargets) -> None:
        self._holidays = holidays
        self._target_weather = target_weather

    def cutoffs(self, issued: date) -> dict[str, date]:
        # Issued in the afternoon: yesterday's consumption and temperature are published.
        return {code: issued - timedelta(days=1) for code in self.inputs}

    def forecast(self, history: History, issued: date) -> list[Forecast]:
        load = history[TARGET]
        last_point = load.last()
        if last_point is None:
            return []
        last = last_point[0]
        rows, ys, train_days = [], [], []
        day = last - timedelta(days=TRAINING_DAYS - 1)
        while day <= last:
            y = load.get(day)
            t = weighted_temperature(history, day)
            if y is not None and t is not None:
                rows.append(features(day, t, self._holidays))
                ys.append(y)
                train_days.append(day)
            day += timedelta(days=1)
        if len(ys) < MIN_TRAINING_DAYS:
            return []
        x, y_arr = np.asarray(rows), np.asarray(ys)
        coef, *_ = np.linalg.lstsq(x, y_arr, rcond=None)
        residuals = y_arr - x @ coef
        recent = residuals[-RESIDUAL_DAYS:]
        correction = float(np.mean(recent))

        targets = [issued + timedelta(days=h) for h in HORIZONS]
        weather, weather_label = self._target_weather(targets)
        out = []
        for h, target in zip(HORIZONS, targets, strict=True):
            temperature = weather.get(target)
            if temperature is None:
                continue
            point = (
                float(np.asarray(features(target, temperature, self._holidays)) @ coef) + correction
            )
            out.append(
                Forecast(
                    issued=issued,
                    target=target,
                    horizon=h,
                    point=point,
                    baselines={
                        "naive": same_weekday_known(load, target, last),
                        "seasonal": seasonal_mean(load, target),
                    },
                    inputs={
                        "last_date": last.isoformat(),
                        "temperature": round(temperature, 2),
                        "weather": weather_label,
                        "recent_error_correction": round(correction, 1),
                        "training_days": len(ys),
                    },
                )
            )
        return out


def observed_weather(full_history: History) -> WeatherForTargets:
    """Backtests: the observed temperature of target days (a perfect weather forecast)."""

    def target_weather(targets: list[date]) -> tuple[dict[date, float], str]:
        out = {t: v for t in targets if (v := weighted_temperature(full_history, t)) is not None}
        return out, "observed temperature (backtest: perfect weather forecast)"

    return target_weather
