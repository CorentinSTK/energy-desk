"""Open-Meteo historical weather (archive API, no key): daily mean temperature of French cities.

`source_ref` is "<latitude>,<longitude>". Every series of the catalogue is fetched in one request
(the API takes lists of coordinates) and served from that response.

Checked live on 2026-10-30:
- `archive-api.open-meteo.com/v1/archive` with `daily=temperature_2m_mean` and
  `timezone=Europe/Paris` returns one object per coordinate, in request order, with `daily.time`
  (local dates) and values in °C.
- History is reanalysis (ERA5 and ERA5-Land, Copernicus C3S); the last few days come from a
  preliminary version and are revised, hence the lookback. Null values are skipped.
- Terms: data under CC BY 4.0 ("Weather data by Open-Meteo.com", with a link); the free API is for
  non-commercial use (no subscriptions, no advertising), under 10,000 calls a day.
Weather forecasts are not observations and are never stored here: the forecast models read them
at issue time and keep them in the forecast's inputs.
"""

from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from worker.catalog import SeriesSpec, load_catalog
from worker.http_client import get_json
from worker.sources.base import Source
from worker.validate import Observation

URL = "https://archive-api.open-meteo.com/v1/archive"
HISTORY_START = date(2015, 1, 1)
TIMEZONE = "Europe/Paris"


def parse_daily(body: dict[str, Any], code: str) -> list[Observation]:
    daily = body.get("daily") or {}
    if daily and body.get("daily_units", {}).get("temperature_2m_mean") not in (None, "°C"):
        raise ValueError(f"{code}: unexpected unit {body['daily_units']['temperature_2m_mean']!r}")
    observations = []
    for day, value in zip(daily.get("time", []), daily.get("temperature_2m_mean", []), strict=True):
        if value is None:
            continue
        d = date.fromisoformat(day)
        observations.append(
            Observation(code, datetime(d.year, d.month, d.day, tzinfo=UTC), float(value))
        )
    return observations


class OpenMeteoSource(Source):
    name = "open_meteo"
    lookback = timedelta(days=10)  # preliminary reanalysis values are revised

    def __init__(self, today: Callable[[], date] = date.today) -> None:
        self._today = today
        self._cache: dict[date | None, dict[str, list[Observation]]] = {}

    def _fetch_all(self, client: httpx.Client, since: date | None) -> dict[str, list[Observation]]:
        if since not in self._cache:
            specs = load_catalog(self.name).series
            coords = [s.source_ref.split(",") for s in specs]
            body = get_json(
                client,
                URL,
                {
                    "latitude": ",".join(c[0] for c in coords),
                    "longitude": ",".join(c[1] for c in coords),
                    "start_date": (since or HISTORY_START).isoformat(),
                    # Yesterday at most: today's mean is incomplete, partly a forecast.
                    "end_date": (self._today() - timedelta(days=1)).isoformat(),
                    "daily": "temperature_2m_mean",
                    "timezone": TIMEZONE,
                },
            )
            bodies = body if isinstance(body, list) else [body]
            if len(bodies) != len(specs):
                raise ValueError(f"expected {len(specs)} locations, got {len(bodies)}")
            self._cache[since] = {
                spec.code: parse_daily(b, spec.code) for spec, b in zip(specs, bodies, strict=True)
            }
        return self._cache[since]

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        return self._fetch_all(client, since).get(spec.code, [])
