"""Elexon Insights Solution (BMRS API): GB market index price, generation by fuel, demand (no key).

`source_ref` is "<dataset>|<field>":
- "mid|half_hourly", "mid|daily_mean": Market Index Data from the APX (EPEX SPOT) provider;
- "fuelhh|<fuelType>": FUELHH generation by fuel type (CCGT, WIND, …, INT* for interconnectors);
- "demand|initialDemandOutturn": national demand outturn (INDO).
Except `mid|half_hourly`, every series is stored per complete Europe/London day as an average
(worker.power): average power in MW, or the time-average price.

Checked live on 2026-10-29:
- `balancing/pricing/market-index` accepts at most 7 days per request (HTTP 400 beyond). Two
  providers are returned: APXMIDP and N2EXMIDP; N2EX reports price 0 with volume 0, so only APXMIDP
  is used. The MID is a volume-weighted index of short-term trades, **not** a day-ahead auction
  price: it is labelled "Elexon MID" and never compared with DE/FR auction prices. A period with
  zero volume has no trades: its price is missing, not zero.
- `datasets/FUELHH/stream` and `demand/outturn/stream` have no 7-day limit (two months per request
  tested); the non-stream versions do.
- FUELHH covers transmission-connected generation only: most GB solar is embedded in distribution
  networks and is absent (a declared gap). INT* values are interconnector flows, negative when GB
  exports (cross-checked with RTE éCO2mix, 29 October 2026).
- Values are MW per settlement period (30 minutes); prices £/MWh.
- Licence: BMRS data licence (full text checked 2026-10-29) — worldwide, royalty-free reuse,
  including publication and commercial use, with the statement "Contains BMRS data © Elexon Limited
  copyright and database right <year>" and, where possible, a link to the licence; no implied
  endorsement.
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

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
MID_URL = f"{BASE_URL}/balancing/pricing/market-index"
STREAM_URLS = {
    "fuelhh": f"{BASE_URL}/datasets/FUELHH/stream",
    "demand": f"{BASE_URL}/demand/outturn/stream",
}
MID_PROVIDER = "APXMIDP"
TZ = ZoneInfo("Europe/London")
SLOT = timedelta(minutes=30)
HISTORY_START = date(2020, 1, 1)
MID_WINDOW = timedelta(days=6)  # the API allows 7 days, both ends included
STREAM_WINDOW = timedelta(days=60)
WINDOW_INTERVAL = 0.2  # seconds between two window requests


def windows(start: date, end: date, size: timedelta) -> list[tuple[date, date]]:
    """Inclusive date windows covering start..end."""
    result = []
    while start <= end:
        result.append((start, min(start + size, end)))
        start = start + size + timedelta(days=1)
    return result


def latest_by_period(rows: list[dict[str, Any]], key: str) -> dict[tuple[str, str], dict[str, Any]]:
    """One row per (startTime, key value); the latest publication wins (revisions)."""
    latest: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        k = (row["startTime"], str(row.get(key, "")))
        if k not in latest or row.get("publishTime", "") >= latest[k].get("publishTime", ""):
            latest[k] = row
    return latest


def parse_mid(rows: list[dict[str, Any]]) -> list[Point]:
    """APX market index per settlement period; periods without trades (volume 0) are missing."""
    points: dict[datetime, float] = {}
    for row in rows:
        if row.get("dataProvider") != MID_PROVIDER or not row.get("volume"):
            continue
        points[datetime.fromisoformat(row["startTime"]).astimezone(UTC)] = float(row["price"])
    return sorted(points.items())


def parse_stream(rows: list[dict[str, Any]], dataset: str) -> dict[str, list[Point]]:
    """Points per field: per fuel type for FUELHH, per demand measure for demand outturn."""
    points: dict[str, list[Point]] = {}
    if dataset == "fuelhh":
        for (start, fuel), row in latest_by_period(rows, "fuelType").items():
            ts = datetime.fromisoformat(start).astimezone(UTC)
            points.setdefault(fuel, []).append((ts, float(row["generation"])))
    else:
        for (start, _), row in latest_by_period(rows, "").items():
            ts = datetime.fromisoformat(start).astimezone(UTC)
            for field, value in row.items():
                if field.endswith("Outturn") and value is not None:
                    points.setdefault(field, []).append((ts, float(value)))
    return points


class ElexonSource(Source):
    name = "elexon"
    lookback = timedelta(days=14)  # initial outturns are revised in the following days
    request_interval = 0.2

    def __init__(self) -> None:
        self._mid: dict[date, list[Point]] = {}
        self._streams: dict[tuple[str, date], dict[str, list[Point]]] = {}

    def _mid_points(self, client: httpx.Client, since: date) -> list[Point]:
        if since not in self._mid:
            rows: list[dict[str, Any]] = []
            end = date.today() + timedelta(days=1)
            for n, (first, last) in enumerate(windows(since - timedelta(days=1), end, MID_WINDOW)):
                if n:
                    time.sleep(WINDOW_INTERVAL)
                body = get_json(
                    client,
                    MID_URL,
                    {
                        "from": f"{first.isoformat()}T00:00Z",
                        "to": f"{last.isoformat()}T23:59Z",
                        "dataProviders": MID_PROVIDER,
                    },
                )
                rows.extend(body.get("data", []))
            self._mid[since] = parse_mid(rows)
        return self._mid[since]

    def _stream_points(
        self, client: httpx.Client, dataset: str, since: date
    ) -> dict[str, list[Point]]:
        if (dataset, since) not in self._streams:
            rows: list[dict[str, Any]] = []
            end = date.today()
            for n, (first, last) in enumerate(windows(since, end, STREAM_WINDOW)):
                if n:
                    time.sleep(WINDOW_INTERVAL)
                body = get_json(
                    client,
                    STREAM_URLS[dataset],
                    {"settlementDateFrom": first.isoformat(), "settlementDateTo": last.isoformat()},
                )
                if not isinstance(body, list):
                    raise ValueError(
                        f"{dataset}: expected a list of rows, got {type(body).__name__}"
                    )
                rows.extend(body)
            self._streams[(dataset, since)] = parse_stream(rows, dataset)
        return self._streams[(dataset, since)]

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        dataset, field = spec.source_ref.split("|")
        start = max(since or HISTORY_START, HISTORY_START)
        if dataset == "mid":
            points = self._mid_points(client, start)
            if field == "half_hourly":
                first, _ = day_bounds(start, TZ)
                return [Observation(spec.code, ts, v) for ts, v in points if ts >= first]
            if field != "daily_mean":
                raise ValueError(f"{spec.code}: unknown MID series kind {field!r}")
        elif dataset in STREAM_URLS:
            points = self._stream_points(client, dataset, start).get(field, [])
        else:
            raise ValueError(f"{spec.code}: unknown Elexon dataset {dataset!r}")
        return [
            Observation(spec.code, day_ts(day), value)
            for day, value in daily_means(points, TZ, SLOT).items()
            if day >= start
        ]
