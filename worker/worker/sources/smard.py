"""SMARD (Bundesnetzagentur): German power data and neighbouring day-ahead prices (no key).

`source_ref` is "<filter>|<region>|<kind>":
- filter: SMARD data series, e.g. 4169 (day-ahead price DE-LU), 254 (France), 410 (load), 4068
  (solar);
- region: SMARD region, "DE-LU" for prices, "DE" for load and generation;
- kind: "hourly" stores SMARD's hourly values as published; "daily_mean" stores the average over
  each complete Europe/Berlin delivery day (worker.power).

Checked live on 2026-10-29:
- `chart_data/<filter>/<region>/index_hour.json` lists weekly chunks (start timestamps in ms);
  `<filter>_<region>_hour_<start>.json` returns [[ms, value | null], …]; null is a missing value.
- Prices are in €/MWh. Since the day-ahead market moved to 15-minute products (1 October 2025),
  SMARD's hourly price is the mean of the four quarter-hours: it matches Energy-Charts exactly
  (France and DE-LU, 26 October 2026). Load and generation are MWh per hour, i.e. the hour's average
  power in MW, so the daily mean is the day's average power in MW.
- Filter 254 is France (same values as Energy-Charts' FR zone); filter 4068 (solar) is 0 at night.
- Germany's last reactors closed on 15 April 2023: nuclear (filter 1224) has no data since, and is
  not catalogued.
- Licence: CC BY 4.0, "Bundesnetzagentur | SMARD.de" (SMARD terms; Energy-Charts states the same
  licence for the prices it takes from SMARD).
"""

import time
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from worker.catalog import SeriesSpec
from worker.http_client import get_json
from worker.power import Point, daily_means, day_bounds, day_ts
from worker.sources.base import Source
from worker.validate import Observation

BASE_URL = "https://www.smard.de/app/chart_data"
TZ = ZoneInfo("Europe/Berlin")
STEP = timedelta(hours=1)
# Five prior years for the seasonal norm, plus the current year (BUILD_SPEC §4).
HISTORY_START = date(2020, 1, 1)
CHUNK_INTERVAL = 0.3  # seconds between two chunk downloads


def parse_ref(spec: SeriesSpec) -> tuple[str, str, str]:
    filter_id, region, kind = spec.source_ref.split("|")
    if kind not in ("hourly", "daily_mean"):
        raise ValueError(f"{spec.code}: unknown SMARD series kind {kind!r}")
    return filter_id, region, kind


def chunks_from(timestamps: list[int], start: datetime) -> list[int]:
    """Chunk starts (ms) covering `start` onwards: the chunk containing it and every later one."""
    start_ms = int(start.timestamp() * 1000)
    ordered = sorted(timestamps)
    first = max((i for i, ts in enumerate(ordered) if ts <= start_ms), default=0)
    return ordered[first:]


def parse_chunk(series: list[list[Any]]) -> list[Point]:
    return [
        (datetime.fromtimestamp(ms / 1000, UTC), float(value))
        for ms, value in series
        if value is not None
    ]


def to_observations(
    spec: SeriesSpec, kind: str, points: list[Point], since: date
) -> list[Observation]:
    if kind == "hourly":
        start, _ = day_bounds(since, TZ)
        return [Observation(spec.code, ts, value) for ts, value in points if ts >= start]
    return [
        Observation(spec.code, day_ts(day), value)
        for day, value in daily_means(points, TZ, STEP).items()
        if day >= since
    ]


class SmardSource(Source):
    name = "smard"
    lookback = timedelta(days=7)
    request_interval = 0.3

    def __init__(self) -> None:
        # Hourly and daily series of the same filter share one download per run.
        self._cache: dict[tuple[str, str, date], list[Point]] = {}

    def _points(
        self, client: httpx.Client, filter_id: str, region: str, since: date
    ) -> list[Point]:
        key = (filter_id, region, since)
        if key not in self._cache:
            index = get_json(client, f"{BASE_URL}/{filter_id}/{region}/index_hour.json")
            start, _ = day_bounds(since, TZ)
            points: list[Point] = []
            for n, chunk in enumerate(chunks_from(index["timestamps"], start)):
                if n:
                    time.sleep(CHUNK_INTERVAL)
                url = f"{BASE_URL}/{filter_id}/{region}/{filter_id}_{region}_hour_{chunk}.json"
                points.extend(parse_chunk(get_json(client, url)["series"]))
            self._cache[key] = points
        return self._cache[key]

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        filter_id, region, kind = parse_ref(spec)
        start = max(since or HISTORY_START, HISTORY_START)
        return to_observations(spec, kind, self._points(client, filter_id, region, start), start)
