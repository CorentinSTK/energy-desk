"""Inputs read at issue time from outside the database: French public holidays and the weather
forecast.

- Holidays: calendrier.api.gouv.fr (Etalab, Licence Ouverte), metropolitan France, checked live on
  2026-10-30 ({"YYYY-MM-DD": "name"}, about twenty years back and a few years ahead).
- Weather forecast: Open-Meteo forecast API, daily mean temperature for the same eight cities as the
  archive series, weighted the same way. Forecasts are not stored as observations; the weighted
  temperature used for each target is kept in the forecast's inputs.
"""

from datetime import date
from typing import Any

import httpx

from worker.catalog import load_catalog
from worker.forecast.models.fr_power import CITY_WEIGHTS, WeatherForTargets
from worker.http_client import get_json

HOLIDAYS_URL = "https://calendrier.api.gouv.fr/jours-feries/metropole.json"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAYS = 10


def parse_holidays(body: dict[str, str]) -> set[date]:
    return {date.fromisoformat(day) for day in body}


def fetch_holidays(client: httpx.Client) -> set[date]:
    return parse_holidays(get_json(client, HOLIDAYS_URL))


def weighted_forecast(bodies: list[dict[str, Any]], cities: list[str]) -> dict[date, float]:
    """Population-weighted daily mean temperature, for days every city has a forecast for."""
    by_city = {
        city: dict(zip(b["daily"]["time"], b["daily"]["temperature_2m_mean"], strict=True))
        for city, b in zip(cities, bodies, strict=True)
    }
    out = {}
    total_weight = sum(CITY_WEIGHTS[c] for c in cities)
    for day in by_city[cities[0]]:
        values = [by_city[c].get(day) for c in cities]
        if all(v is not None for v in values):
            out[date.fromisoformat(day)] = (
                sum(
                    CITY_WEIGHTS[c] * float(v)
                    for c, v in zip(cities, values, strict=True)
                    if v is not None
                )
                / total_weight
            )
    return out


def forecast_weather(client: httpx.Client) -> WeatherForTargets:
    """Live forecasts: the Open-Meteo forecast for the target days, fetched once."""
    specs = load_catalog("open_meteo").series
    cities = [s.code.split(".")[2] for s in specs]
    coords = [s.source_ref.split(",") for s in specs]
    body = get_json(
        client,
        FORECAST_URL,
        {
            "latitude": ",".join(c[0] for c in coords),
            "longitude": ",".join(c[1] for c in coords),
            "daily": "temperature_2m_mean",
            "timezone": "Europe/Paris",
            "forecast_days": FORECAST_DAYS,
        },
    )
    weighted = weighted_forecast(body if isinstance(body, list) else [body], cities)

    def target_weather(targets: list[date]) -> tuple[dict[date, float], str]:
        return {t: weighted[t] for t in targets if t in weighted}, "Open-Meteo weather forecast"

    return target_weather
