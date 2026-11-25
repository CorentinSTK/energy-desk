from datetime import UTC, datetime

import pytest

from worker.catalog import load_catalog
from worker.sources.open_meteo_de import daily_mean, parse_location

SPECS = {s.code: s for s in load_catalog("open_meteo_de").series}


def hours(day: str, n: int) -> list[str]:
    return [f"{day}T{h:02d}:00" for h in range(n)]


def test_daily_mean_keeps_complete_days_only() -> None:
    times = hours("2026-11-10", 24) + hours("2026-11-11", 12)
    values: list[float | None] = [*([10.0] * 24), *([20.0] * 12)]
    assert daily_mean(times, values) == {"2026-11-10": 10.0}


def test_a_day_with_a_missing_hour_has_no_value() -> None:
    values: list[float | None] = [10.0] * 23 + [None]
    assert daily_mean(hours("2026-11-10", 24), values) == {}


def test_clock_change_days_of_23_hours_count() -> None:
    # Last Sunday of March: 23 local hours.
    assert daily_mean(hours("2026-03-29", 23), [12.0] * 23) == {"2026-03-29": 12.0}


def test_parse_wind_and_radiation_locations() -> None:
    body = {
        "hourly_units": {"wind_speed_100m": "km/h"},
        "hourly": {"time": hours("2026-11-10", 24), "wind_speed_100m": [18.0] * 24},
        "daily_units": {"shortwave_radiation_sum": "MJ/m²"},
        "daily": {"time": ["2026-11-10"], "shortwave_radiation_sum": [3.86]},
    }
    wind = parse_location(body, SPECS["open_meteo_de.wind.husum"])
    solar = parse_location(body, SPECS["open_meteo_de.solar.munich"])
    assert [(o.ts, o.value) for o in wind] == [(datetime(2026, 11, 10, tzinfo=UTC), 18.0)]
    assert [o.value for o in solar] == [3.86]


def test_a_unit_change_fails_loudly() -> None:
    body = {
        "hourly_units": {"wind_speed_100m": "m/s"},
        "hourly": {"time": hours("2026-11-10", 24), "wind_speed_100m": [5.0] * 24},
    }
    with pytest.raises(ValueError, match="unexpected unit"):
        parse_location(body, SPECS["open_meteo_de.wind.husum"])
