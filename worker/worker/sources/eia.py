"""U.S. Energy Information Administration, API v2 (free key).

`source_ref` is "<route>|<series facet>", e.g. "petroleum/pri/spt|RWTC": the request goes to
https://api.eia.gov/v2/<route>/data/ with facets[series][]=<facet>.

Checked live on 2026-10-28:
- At most 5,000 rows per request: responses are paged with `offset` until `total` is reached.
- Values come as strings; a null value is a missing observation and is skipped.
- Each row carries its unit (e.g. "$/BBL"); it must match the catalogue's `source_unit`.
"""

import time
from datetime import UTC, date, datetime
from typing import Any

import httpx

from worker.catalog import SeriesSpec
from worker.config import get_settings, require
from worker.http_client import get_json
from worker.sources.base import Source
from worker.validate import Observation

BASE_URL = "https://api.eia.gov/v2"
PAGE_SIZE = 5000


class UnitMismatch(Exception):
    pass


def parse_rows(rows: list[dict[str, Any]], spec: SeriesSpec) -> list[Observation]:
    observations = []
    for row in rows:
        if spec.source_unit is not None and row.get("units") != spec.source_unit:
            raise UnitMismatch(
                f"{spec.code}: expected {spec.source_unit!r}, got {row.get('units')!r}"
            )
        if row.get("value") in (None, ""):
            continue
        day = date.fromisoformat(row["period"])
        ts = datetime(day.year, day.month, day.day, tzinfo=UTC)
        observations.append(Observation(spec.code, ts, float(row["value"])))
    return observations


class EiaSource(Source):
    name = "eia"

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key

    def _key(self) -> str:
        return self._api_key or require(get_settings().eia_api_key, "EIA_API_KEY")

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        route, facet = spec.source_ref.split("|")
        params: dict[str, Any] = {
            "api_key": self._key(),
            "frequency": spec.frequency,
            "data[0]": "value",
            "facets[series][]": facet,
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "length": PAGE_SIZE,
        }
        if since is not None:
            params["start"] = since.isoformat()

        observations: list[Observation] = []
        offset = 0
        while True:
            body = get_json(client, f"{BASE_URL}/{route}/data/", {**params, "offset": offset})
            response = body["response"]
            rows = response["data"]
            observations += parse_rows(rows, spec)
            offset += len(rows)
            if not rows or offset >= int(response["total"]):
                return observations
            time.sleep(self.request_interval)
