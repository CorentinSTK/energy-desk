"""Day-ahead base power price, two days ahead, for Germany-Luxembourg and France (ADR 0016).

Method, in two sentences: the next unknown day-ahead price is explained by the latest known price
(persistence carries the fuel and carbon cost level), German wind and sunshine on the target day
(wind and solar output push the price down across the coupled market), the day of the week and,
for France, the cold (electric heating) and public holidays. It is a linear regression refitted on
the year before each issue date.

Timing: forecasts are issued in the evening (22:30 UTC). By then the noon auction has already priced
tomorrow, so the target is the day after tomorrow (horizon 2), and tomorrow's price is the latest
known value. Baselines: "naive" = that latest known price; "seasonal" = the price on the same
weekday one week before the target.

Weather of the target day is the one input from after the issue date. Live forecasts read the
Open-Meteo weather forecast at issue time and keep it in the forecast's inputs; backtests use the
observed weather (a perfect weather forecast), so backtest errors are smaller than live ones.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np

from worker.forecast.core import Forecast, Model
from worker.forecast.data import History, Series
from worker.forecast.models.fr_power import HEATING_BASE, TEMPERATURES, weighted_temperature

WIND_SITES = tuple(
    f"open_meteo_de.wind.{s}"
    for s in ("german_bight", "baltic", "husum", "emden", "magdeburg", "cottbus")
)
SOLAR_SITES = tuple(
    f"open_meteo_de.solar.{s}"
    for s in ("munich", "nuremberg", "stuttgart", "cologne", "hanover", "berlin")
)
HORIZON = 2
TRAINING_DAYS = 365
MIN_TRAINING_DAYS = 200
WEATHER_LAG_DAYS = 6  # the weather archive is final about five days after the day


@dataclass(frozen=True)
class TargetWeather:
    """Weather of one target day: German wind and solar indices, French temperature if needed."""

    wind: float
    solar: float
    temperature: float | None = None


# Weather of target days: target dates → ({date: weather}, label kept in the inputs).
WeatherForTargets = Callable[[list[date]], tuple[dict[date, TargetWeather], str]]


def site_mean(history: History, codes: Sequence[str], day: date) -> float | None:
    """Unweighted mean over the sites; None unless every site has a value that day."""
    values = [history[c].get(day) for c in codes]
    if any(v is None for v in values):
        return None
    return float(np.mean([v for v in values if v is not None]))


def observed(history: History, day: date, with_temperature: bool) -> TargetWeather | None:
    wind = site_mean(history, WIND_SITES, day)
    solar = site_mean(history, SOLAR_SITES, day)
    temperature = weighted_temperature(history, day) if with_temperature else None
    if wind is None or solar is None or (with_temperature and temperature is None):
        return None
    return TargetWeather(wind, solar, temperature)


def features(
    day: date, last_price: float, weather: TargetWeather, holidays: set[date] | None
) -> list[float]:
    """Regressors: intercept, latest known price, wind (linear and squared), solar, weekday, and
    for France heating degree-days and a holiday flag."""
    weekday = [1.0 if day.weekday() == k else 0.0 for k in range(1, 7)]  # Monday is the reference
    row = [
        1.0,
        last_price,
        weather.wind,
        weather.wind**2 / 100,  # output rises then flattens with wind speed
        weather.solar,
        *weekday,
    ]
    if holidays is not None:
        temperature = weather.temperature if weather.temperature is not None else HEATING_BASE
        row += [max(0.0, HEATING_BASE - temperature), 1.0 if day in holidays else 0.0]
    return row


@dataclass(frozen=True)
class Zone:
    id: str
    name: str
    price_code: str
    french: bool  # adds temperature and holidays


def inputs_for(zone: "Zone") -> tuple[str, ...]:
    """Every series the zone's model reads: its price and the weather of the price models."""
    weather = (*WIND_SITES, *SOLAR_SITES, *(TEMPERATURES if zone.french else ()))
    return (zone.price_code, *weather)


ZONES = {
    "de_lu": Zone("de_lu", "Germany-Luxembourg", "smard.de_lu.price_da_base", french=False),
    "fr": Zone("fr", "France", "smard.fr.price_da_base", french=True),
}


class DayAheadPrice(Model):
    horizon_unit = "day"
    version = "1"

    def __init__(
        self, zone: Zone, target_weather: WeatherForTargets, holidays: set[date] | None = None
    ) -> None:
        self.zone = zone
        self.id = f"{zone.id}_da_price"
        self.name = f"{zone.name} day-ahead base price"
        self.target_code = zone.price_code
        self.description = (
            f"{zone.name} day-ahead base price two days ahead from a regression on the latest "
            "known price, German wind and sunshine, the weekday"
            + (", French heating degree-days and holidays" if zone.french else "")
            + ", refitted on the past year."
        )
        self.inputs = inputs_for(zone)
        self._target_weather = target_weather
        self._holidays = holidays if zone.french else None

    def cutoffs(self, issued: date) -> dict[str, date]:
        # Issued at 22:30 UTC: the noon auction has priced tomorrow; the archive lags five days.
        out = {code: issued - timedelta(days=WEATHER_LAG_DAYS) for code in self.inputs}
        out[self.zone.price_code] = issued + timedelta(days=1)
        return out

    def forecast(self, history: History, issued: date) -> list[Forecast]:
        price = history[self.zone.price_code]
        known = price.get(issued + timedelta(days=1))
        if known is None:
            return []  # tomorrow's auction result is missing: no basis for the forecast
        rows, ys = self._training(history, price, issued)
        if len(ys) < MIN_TRAINING_DAYS:
            return []
        x, y = np.asarray(rows), np.asarray(ys)
        coef, *_ = np.linalg.lstsq(x, y, rcond=None)

        target = issued + timedelta(days=HORIZON)
        weather, label = self._target_weather([target])
        w = weather.get(target)
        if w is None or (self.zone.french and w.temperature is None):
            return []
        point = float(np.asarray(features(target, known, w, self._holidays)) @ coef)
        inputs: dict[str, object] = {
            "latest_known_price": round(known, 2),
            "wind_index_kmh": round(w.wind, 1),
            "solar_index_mj_m2": round(w.solar, 2),
            "weather": label,
            "training_days": len(ys),
        }
        if w.temperature is not None:
            inputs["temperature"] = round(w.temperature, 2)
        return [
            Forecast(
                issued=issued,
                target=target,
                horizon=HORIZON,
                point=point,
                baselines={"naive": known, "seasonal": price.get(target - timedelta(days=7))},
                inputs=inputs,
            )
        ]

    def _training(
        self, history: History, price: Series, issued: date
    ) -> tuple[list[list[float]], list[float]]:
        """Days with a price, the previous day's price and observed weather, in the past year."""
        rows, ys = [], []
        last_weather = issued - timedelta(days=WEATHER_LAG_DAYS)
        day = last_weather - timedelta(days=TRAINING_DAYS - 1)
        while day <= last_weather:
            y = price.get(day)
            previous = price.get(day - timedelta(days=1))
            w = observed(history, day, self.zone.french)
            if y is not None and previous is not None and w is not None:
                rows.append(features(day, previous, w, self._holidays))
                ys.append(y)
            day += timedelta(days=1)
        return rows, ys


def observed_weather(full_history: History, french: bool) -> WeatherForTargets:
    """Backtests: the observed weather of target days (a perfect weather forecast)."""

    def target_weather(targets: list[date]) -> tuple[dict[date, TargetWeather], str]:
        out = {t: w for t in targets if (w := observed(full_history, t, french)) is not None}
        return out, "observed weather (backtest: perfect weather forecast)"

    return target_weather
