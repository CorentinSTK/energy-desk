from datetime import date

import httpx
import pytest
import respx

from worker.forecast.live_inputs import (
    FORECAST_URL,
    forecast_weather,
    parse_holidays,
    weighted_forecast,
)
from worker.forecast.models.fr_power import CITY_WEIGHTS
from worker.http_client import make_client


def test_holidays_are_dates() -> None:
    # Shape of the live response (2026-10-30), trimmed.
    assert parse_holidays({"2026-11-01": "Toussaint", "2026-12-25": "Jour de Noël"}) == {
        date(2026, 11, 1),
        date(2026, 12, 25),
    }


def city(values: list[float | None]) -> dict[str, object]:
    return {"daily": {"time": ["2026-10-31", "2026-11-01"], "temperature_2m_mean": values}}


def test_weather_is_weighted_by_population_and_needs_every_city() -> None:
    cities = list(CITY_WEIGHTS)
    bodies = [city([10.0, None if i == 3 else 5.0]) for i in range(len(cities))]
    bodies[0] = city([20.0, 5.0])  # Paris warmer on the first day
    weighted = weighted_forecast(bodies, cities)
    total = sum(CITY_WEIGHTS.values())
    assert weighted[date(2026, 10, 31)] == pytest.approx(10 + 10 * CITY_WEIGHTS["paris"] / total)
    assert date(2026, 11, 1) not in weighted  # one city had no value that day


@respx.mock
def test_live_weather_is_labelled_as_a_forecast() -> None:
    respx.get(FORECAST_URL).mock(
        return_value=httpx.Response(200, json=[city([10.0, 9.0]) for _ in CITY_WEIGHTS])
    )
    with make_client() as client:
        weather = forecast_weather(client)
    values, label = weather([date(2026, 10, 31), date(2026, 11, 5)])
    assert values == {date(2026, 10, 31): pytest.approx(10.0)}
    assert label == "Open-Meteo weather forecast"
