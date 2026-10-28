"""FRED, Federal Reserve Bank of St. Louis (free key).

`source_ref` is the FRED series ID. Licences vary per series: FRED republishes data owned by others
(e.g. IMF, CBOE), so each series' notes are read before it is added to the catalogue.

Checked live on 2026-10-28: missing observations are returned with the value "." and are skipped.
Monthly observations are dated on the first day of the month.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from worker.catalog import SeriesSpec
from worker.config import get_settings, require
from worker.http_client import get_json
from worker.sources.base import Source
from worker.validate import Observation

URL = "https://api.stlouisfed.org/fred/series/observations"


def parse_observations(rows: list[dict[str, Any]], spec: SeriesSpec) -> list[Observation]:
    observations = []
    for row in rows:
        if row["value"] in (".", ""):
            continue
        day = date.fromisoformat(row["date"])
        ts = datetime(day.year, day.month, day.day, tzinfo=UTC)
        observations.append(Observation(spec.code, ts, float(row["value"])))
    return observations


class FredSource(Source):
    name = "fred"
    lookback = timedelta(days=120)  # monthly data is revised for a few months

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        params: dict[str, Any] = {
            "series_id": spec.source_ref,
            "api_key": self._api_key or require(get_settings().fred_api_key, "FRED_API_KEY"),
            "file_type": "json",
            "sort_order": "asc",
        }
        if since is not None:
            params["observation_start"] = since.isoformat()
        body = get_json(client, URL, params)
        return parse_observations(body["observations"], spec)
