"""Open-Meteo historical weather for Germany (archive API, no key): wind at 100 m and sunshine.

Inputs of the day-ahead power price forecasts (ADR 0016): wind and sunshine drive German wind and
solar output, which move prices across the coupled central-western European market.

`source_ref` is "<latitude>,<longitude>|<variable>":
- `wind100`: daily mean of the hourly wind speed at 100 m (km/h) over the local day (Europe/Berlin).
  A day counts only if every hour of it has a value (23 to 25 hours across clock changes).
- `radiation`: daily sum of shortwave radiation (MJ/m²), as Open-Meteo aggregates it.

Checked live on 2026-11-25: `hourly=wind_speed_100m` in km/h and `daily=shortwave_radiation_sum` in
MJ/m², one object per coordinate in request order. Same terms as the French temperatures
(worker/sources/open_meteo.py): CC BY 4.0, ERA5 reanalysis from Copernicus C3S, free API for
non-commercial use. Weather forecasts are never stored here: models read them at issue time.
"""

from collections import defaultdict
from collections.abc import Callable, Sequence
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from worker.catalog import SeriesSpec, load_catalog
from worker.http_client import get_json
from worker.sources.base import Source
from worker.validate import Observation

URL = "https://archive-api.open-meteo.com/v1/archive"
HISTORY_START = date(2018, 1, 1)
TIMEZONE = "Europe/Berlin"
MIN_HOURS = 23  # a local day has 23 to 25 hours across clock changes
UNITS = {"wind_speed_100m": "km/h", "shortwave_radiation_sum": "MJ/m²"}


def parse_ref(spec: SeriesSpec) -> tuple[str, str]:
    coords, variable = spec.source_ref.split("|")
    if variable not in ("wind100", "radiation"):
        raise ValueError(f"{spec.code}: unknown variable {variable!r}")
    return coords, variable


def _check_unit(body: dict[str, Any], group: str, name: str, code: str) -> None:
    unit = body.get(f"{group}_units", {}).get(name)
    if unit not in (None, UNITS[name]):
        raise ValueError(f"{code}: unexpected unit {unit!r} for {name}")


def _midnight(day: str) -> datetime:
    d = date.fromisoformat(day)
    return datetime(d.year, d.month, d.day, tzinfo=UTC)


def daily_mean(times: Sequence[str], values: Sequence[float | None]) -> dict[str, float]:
    """Mean of hourly values per local day ("YYYY-MM-DDTHH:MM" times), complete days only."""
    by_day: dict[str, list[float | None]] = defaultdict(list)
    for t, v in zip(times, values, strict=True):
        by_day[t[:10]].append(v)
    return {
        day: sum(v for v in vs if v is not None) / len(vs)
        for day, vs in by_day.items()
        if len(vs) >= MIN_HOURS and all(v is not None for v in vs)
    }


def parse_location(body: dict[str, Any], spec: SeriesSpec) -> list[Observation]:
    _, variable = parse_ref(spec)
    if variable == "wind100":
        hourly = body.get("hourly") or {}
        _check_unit(body, "hourly", "wind_speed_100m", spec.code)
        means = daily_mean(hourly.get("time", []), hourly.get("wind_speed_100m", []))
        return [Observation(spec.code, _midnight(d), v) for d, v in sorted(means.items())]
    daily = body.get("daily") or {}
    _check_unit(body, "daily", "shortwave_radiation_sum", spec.code)
    pairs = zip(daily.get("time", []), daily.get("shortwave_radiation_sum", []), strict=True)
    return [Observation(spec.code, _midnight(d), float(v)) for d, v in pairs if v is not None]


class OpenMeteoDeSource(Source):
    name = "open_meteo_de"
    lookback = timedelta(days=10)  # preliminary reanalysis values are revised

    def __init__(self, today: Callable[[], date] = date.today) -> None:
        self._today = today
        self._cache: dict[date | None, dict[str, list[Observation]]] = {}

    def _fetch_all(self, client: httpx.Client, since: date | None) -> dict[str, list[Observation]]:
        if since not in self._cache:
            specs = load_catalog(self.name).series
            locations = sorted({parse_ref(s)[0] for s in specs})
            body = get_json(
                client,
                URL,
                {
                    "latitude": ",".join(loc.split(",")[0] for loc in locations),
                    "longitude": ",".join(loc.split(",")[1] for loc in locations),
                    "start_date": (since or HISTORY_START).isoformat(),
                    # Yesterday at most: today is incomplete, partly a forecast.
                    "end_date": (self._today() - timedelta(days=1)).isoformat(),
                    "hourly": "wind_speed_100m",
                    "daily": "shortwave_radiation_sum",
                    "timezone": TIMEZONE,
                },
            )
            bodies = body if isinstance(body, list) else [body]
            if len(bodies) != len(locations):
                raise ValueError(f"expected {len(locations)} locations, got {len(bodies)}")
            by_location = dict(zip(locations, bodies, strict=True))
            self._cache[since] = {
                s.code: parse_location(by_location[parse_ref(s)[0]], s) for s in specs
            }
        return self._cache[since]

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        return self._fetch_all(client, since).get(spec.code, [])
