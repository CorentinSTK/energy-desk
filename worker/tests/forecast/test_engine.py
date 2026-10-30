"""Forecast engine: no look-ahead, walk-forward intervals, three models on synthetic data."""

import math
from dataclasses import replace
from datetime import date, timedelta

import pytest

from worker.forecast.backtest import backtest
from worker.forecast.core import MIN_ERRORS_FOR_INTERVAL, Forecast, Model, with_interval
from worker.forecast.data import History, Series, days
from worker.forecast.metrics import score
from worker.forecast.models import eu_storage, fr_power, us_crude
from worker.forecast.models.eu_storage import EuStorage30d
from worker.forecast.models.fr_power import FrPowerDemand, observed_weather
from worker.forecast.models.us_crude import UsCrudeStocks


def seasonal(day: date, mean: float, amplitude: float, phase_day: int = 0) -> float:
    return mean + amplitude * math.sin(2 * math.pi * (day.timetuple().tm_yday - phase_day) / 365.25)


def storage_history() -> History:
    """A smooth seasonal storage cycle with a small trend, daily from 2015."""
    dates = days(date(2015, 1, 1), date(2024, 12, 31))
    values = [seasonal(d, 60, 30, 120) + 0.002 * (d - dates[0]).days for d in dates]
    return History({eu_storage.TARGET: Series(dates, values)})


def power_history() -> History:
    """French load driven by a known function of temperature and weekday."""
    dates = days(date(2015, 1, 1), date(2022, 12, 31))
    temps = {d: seasonal(d, 12, 9, 110) + 2 * math.sin(d.toordinal() / 3) for d in dates}
    load = [
        50_000 + 2_000 * max(0.0, 15 - temps[d]) - (4_000 if d.weekday() >= 5 else 0) for d in dates
    ]
    series = {fr_power.TARGET: Series(dates, load)}
    for code in fr_power.TEMPERATURES:
        series[code] = Series(dates, [temps[d] for d in dates])
    return History(series)


def crude_history() -> History:
    """Weekly stocks, utilisation and net imports with a seasonal cycle, Fridays from 2000."""
    start = date(2000, 1, 7)
    fridays = [start + timedelta(days=7 * k) for k in range(1300)]
    stocks = [400_000 + 20_000 * math.sin(2 * math.pi * k / 52.18) for k in range(len(fridays))]
    util = [seasonal(d, 88, 5, 60) for d in fridays]
    imports = [3_000 + 300 * math.sin(k / 5) for k in range(len(fridays))]
    return History(
        {
            us_crude.STOCKS: Series(fridays, stocks),
            us_crude.UTILISATION: Series(fridays, util),
            us_crude.NET_IMPORTS: Series(fridays, imports),
        }
    )


def perturb_after(history: History, day: date) -> History:
    """Same history with every value after `day` changed: the future, as a model must not see it."""
    return History(
        {
            code: Series(
                s.dates,
                [v * 3 + 1000 if d > day else v for d, v in zip(s.dates, s.values, strict=True)],
            )
            for code, s in history.series.items()
        }
    )


class SpyModel(Model):
    id = "spy"
    name = "spy"
    target_code = "x"
    horizon_unit = "day"
    version = "1"
    description = ""
    inputs = ("x",)

    def __init__(self) -> None:
        self.seen: list[tuple[date, date | None]] = []

    def cutoffs(self, issued: date) -> dict[str, date]:
        return {"x": issued - timedelta(days=1)}

    def forecast(self, history: History, issued: date) -> list[Forecast]:
        last = history["x"].last()
        self.seen.append((issued, last[0] if last else None))
        return [Forecast(issued, issued + timedelta(days=2), 2, 0.0, {})]


def test_backtest_only_shows_the_model_what_was_published() -> None:
    dates = days(date(2020, 1, 1), date(2020, 3, 1))
    spy = SpyModel()
    backtest(
        spy, History({"x": Series(dates, [1.0] * len(dates))}), date(2020, 2, 1), date(2020, 2, 10)
    )
    assert all(last == issued - timedelta(days=1) for issued, last in spy.seen)


@pytest.mark.parametrize(
    ("model", "history", "issued"),
    [
        (EuStorage30d(), storage_history(), date(2023, 6, 15)),
        (UsCrudeStocks(), crude_history(), date(2023, 6, 13)),  # a Tuesday
    ],
)
def test_the_future_cannot_change_a_forecast(model: Model, history: History, issued: date) -> None:
    cutoff = min(model.cutoffs(issued).values())
    original = model.forecast(history.as_of(model.cutoffs(issued)), issued)
    tampered = perturb_after(history, cutoff)
    assert original
    assert model.forecast(tampered.as_of(model.cutoffs(issued)), issued) == original


def test_french_demand_only_takes_target_day_weather_from_outside() -> None:
    history = power_history()
    issued = date(2021, 2, 10)
    cutoff = issued - timedelta(days=1)
    tampered = perturb_after(history, cutoff)
    # Target-day weather comes from the untouched history in both runs: only the past may differ.
    model = FrPowerDemand(set(), observed_weather(history))
    assert model.forecast(tampered.as_of(model.cutoffs(issued)), issued) == model.forecast(
        history.as_of(model.cutoffs(issued)), issued
    )


def test_intervals_use_only_outcomes_published_at_issue_time() -> None:
    model = EuStorage30d()
    history = storage_history()
    forecasts = backtest(model, history, date(2022, 1, 1), date(2022, 6, 30))
    # The first 30 days of forecasts have no published outcome yet, so no errors and no interval.
    first = [f for f in forecasts if f.issued < date(2022, 1, 1) + timedelta(days=30)]
    assert all(f.lo90 is None for f in first)
    with_ci = [f for f in forecasts if f.lo90 is not None]
    # A forecast issued on day d targets d + 29 and becomes a usable error from day d + 30; the
    # 50th error (forecast issued on start + 49) is therefore usable from start + 79.
    assert with_ci
    assert min(f.issued for f in with_ci) == date(2022, 1, 1) + timedelta(
        days=29 + MIN_ERRORS_FOR_INTERVAL
    )
    assert all(
        f.lo90 <= f.point <= f.hi90 for f in with_ci if f.lo90 is not None and f.hi90 is not None
    )


def test_interval_quantiles_and_minimum_sample() -> None:
    f = Forecast(date(2026, 1, 1), date(2026, 1, 2), 1, 100.0, {})
    assert with_interval(f, [1.0] * (MIN_ERRORS_FOR_INTERVAL - 1)) == f
    widened = with_interval(f, [float(e) for e in range(-50, 51)])
    assert widened.lo90 == pytest.approx(55.0) and widened.hi90 == pytest.approx(145.0)
    one_sided = with_interval(f, [float(e) for e in range(1, 101)])
    assert one_sided.lo90 == 100.0  # widened to include the point


def test_storage_model_beats_no_change_on_a_seasonal_cycle() -> None:
    history = storage_history()
    forecasts = backtest(EuStorage30d(), history, date(2022, 1, 1), date(2023, 12, 31))
    result = score(forecasts, history[eu_storage.TARGET].as_dict())
    assert result is not None
    assert result.skill["naive"] is not None and result.skill["naive"] > 0.5
    assert result.mae < 1.0


def test_demand_model_learns_the_temperature_response() -> None:
    history = power_history()
    model = FrPowerDemand(set(), observed_weather(history))
    forecasts = model.forecast(history.as_of(model.cutoffs(date(2021, 2, 10))), date(2021, 2, 10))
    assert [f.horizon for f in forecasts] == list(range(1, 8))
    assert forecasts[0].target == date(2021, 2, 11)
    realised = history[fr_power.TARGET].as_dict()
    assert all(abs(f.point - realised[f.target]) < 2_000 for f in forecasts)
    assert forecasts[0].inputs["weather"].startswith("observed")


def test_crude_model_targets_last_friday_and_its_baselines() -> None:
    history = crude_history()
    model = UsCrudeStocks()
    issued = date(2023, 6, 13)  # Tuesday
    [f] = model.forecast(history.as_of(model.cutoffs(issued)), issued)
    assert f.target == date(2023, 6, 9)  # the Friday before: published on Wednesday 14 June
    assert f.baselines["naive"] == history[us_crude.STOCKS].get(date(2023, 6, 2))
    assert model.issue_dates(date(2023, 6, 1), date(2023, 6, 30)) == [
        date(2023, 6, 6),
        date(2023, 6, 13),
        date(2023, 6, 20),
        date(2023, 6, 27),
    ]


def test_score_compares_with_baselines_on_the_same_targets() -> None:
    day = date(2026, 1, 1)
    forecasts = [
        Forecast(day, day + timedelta(days=i), 1, 10.0, {"naive": 12.0}) for i in range(1, 3)
    ]
    realised = {day + timedelta(days=1): 11.0, day + timedelta(days=2): 9.0}
    result = score(forecasts, realised)
    assert result is not None
    assert result.mae == pytest.approx(1.0)
    assert result.skill["naive"] == pytest.approx(1 - 1.0 / 2.0)
    assert replace(forecasts[0], point=11.0).point == 11.0
