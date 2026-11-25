"""Day-ahead price models: what they may see, what they forecast, and that they learn drivers."""

import math
from datetime import date, timedelta

import numpy as np

from worker.forecast.data import History, Series, days
from worker.forecast.models import da_price
from worker.forecast.models.da_price import DayAheadPrice, observed_weather

START, END = date(2021, 1, 1), date(2022, 12, 31)


def wind(day: date) -> float:
    return 20 + 10 * math.sin(day.toordinal() / 3.0)


def solar(day: date) -> float:
    return 8 + 6 * math.sin(2 * math.pi * (day.timetuple().tm_yday - 80) / 365)


def synthetic_history(noise: float = 0.0) -> History:
    """German weather at every site, and a DE-LU price that falls with wind and sun."""
    dates = days(START, END)
    rng = np.random.default_rng(1)
    series = {code: Series(dates, [wind(d) for d in dates]) for code in da_price.WIND_SITES} | {
        code: Series(dates, [solar(d) for d in dates]) for code in da_price.SOLAR_SITES
    }
    prices = [
        150
        - 2.0 * wind(d)
        - 3.0 * solar(d)
        + (10 if d.weekday() < 5 else 0)
        + noise * rng.standard_normal()
        for d in dates
    ]
    series[da_price.ZONES["de_lu"].price_code] = Series(dates, prices)
    return History(series)


def model_for(history: History) -> DayAheadPrice:
    return DayAheadPrice(da_price.ZONES["de_lu"], observed_weather(history, french=False))


def test_targets_the_day_after_tomorrow_with_tomorrows_price_as_naive() -> None:
    history = synthetic_history()
    model = model_for(history)
    issued = date(2022, 6, 15)
    [f] = model.forecast(history.as_of(model.cutoffs(issued)), issued)
    assert (f.target, f.horizon) == (issued + timedelta(days=2), 2)
    price = history[model.target_code]
    assert f.baselines["naive"] == price.get(issued + timedelta(days=1))
    assert f.baselines["seasonal"] == price.get(f.target - timedelta(days=7))


def test_learns_the_wind_and_solar_effect() -> None:
    history = synthetic_history(noise=1.0)
    model = model_for(history)
    issued = date(2022, 9, 1)
    [f] = model.forecast(history.as_of(model.cutoffs(issued)), issued)
    actual = history[model.target_code].get(f.target)
    assert actual is not None
    assert abs(f.point - actual) < 5  # noise is 1 €/MWh; the naive error is far larger here
    assert abs(f.point - actual) < abs(float(f.baselines["naive"] or 0) - actual)


def test_the_future_cannot_change_a_forecast() -> None:
    history = synthetic_history()
    model = model_for(history)
    issued = date(2022, 6, 15)
    cutoffs = model.cutoffs(issued)
    assert cutoffs[model.target_code] == issued + timedelta(days=1)  # the noon auction priced it
    tampered = History(
        {
            code: Series(
                s.dates,
                [
                    v * 3 + 1000 if d > cutoffs[code] else v
                    for d, v in zip(s.dates, s.values, strict=True)
                ],
            )
            for code, s in history.series.items()
        }
    )
    # Target-day weather comes from the untouched history in both runs: only the past may differ.
    original = model.forecast(history.as_of(cutoffs), issued)
    assert original
    assert model.forecast(tampered.as_of(cutoffs), issued) == original


def test_no_forecast_without_tomorrows_auction_result() -> None:
    history = synthetic_history()
    model = model_for(history)
    issued = date(2022, 6, 15)
    price = history[model.target_code]
    gap = date(2022, 6, 16)
    holed = History(
        {
            **history.series,
            model.target_code: Series.of(
                (d, v) for d, v in zip(price.dates, price.values, strict=True) if d != gap
            ),
        }
    )
    assert model.forecast(holed.as_of(model.cutoffs(issued)), issued) == []
