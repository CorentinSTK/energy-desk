"""GIE transparency platforms (free key in the `x-key` header): AGSI+ (gas storage) and ALSI (LNG).

`source_ref` is "<area>|<field>": area is "eu" (EU aggregate), a country code ("DE") or one facility
as "<country>~<company EIC>~<facility EIC>" (e.g. one LNG terminal); field is a platform field, with
a dot for nested values ("inventory.gwh" for ALSI's {"inventory": {"gwh": …}}).

Checked live on 2026-10-28 (both platforms share the API shape):
- One request returns every field for an area and day, so responses are cached per area for the
  run: several series of the same country cost one set of requests.
- Pages of up to 300 days (`size`, `page`, `last_page`).
- `country=EU` silently returns no rows: the EU aggregate needs `type=eu`.
- Values come as strings; "-" means no data and is skipped. Rows with status "N" (no data) are
  skipped. Status "E" (estimated) values are stored and overwritten when GIE confirms them, which
  is why the lookback window is long.
- The United Kingdom is listed as "Pre-Brexit" with no data on either platform: a declared gap.
- Facilities (checked 2026-10-30): `?country=FR&company=<EIC>&facility=<EIC>` returns one terminal
  or storage site, in the same row shape; the list is at /api/about?show=listing.
"""

import time
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from worker.catalog import SeriesSpec
from worker.config import get_settings, require
from worker.http_client import get_json, make_client
from worker.sources.base import Source
from worker.validate import Observation

AGSI_URL = "https://agsi.gie.eu/api"
ALSI_URL = "https://alsi.gie.eu/api"
PAGE_SIZE = 300
NO_DATA = {"-", "", None}


def area_params(area: str) -> dict[str, str]:
    """Query parameters for an area: the EU aggregate, a country, or one facility."""
    if area.lower() == "eu":
        return {"type": "eu"}
    if "~" in area:
        country, company, facility = area.split("~")
        return {"country": country, "company": company, "facility": facility}
    return {"country": area}


def field_value(row: dict[str, Any], field: str) -> Any:
    """Read a possibly nested field: "inventory.gwh" → row["inventory"]["gwh"]."""
    value: Any = row
    for part in field.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def parse_rows(rows: list[dict[str, Any]], field: str, series_code: str) -> list[Observation]:
    observations = []
    for row in rows:
        value = field_value(row, field)
        if row.get("status") == "N" or value in NO_DATA:
            continue
        day = date.fromisoformat(row["gasDayStart"])
        ts = datetime(day.year, day.month, day.day, tzinfo=UTC)
        observations.append(Observation(series_code, ts, float(value)))
    return observations


class GieSource(Source):
    url: str
    lookback = timedelta(days=60)  # estimated values are confirmed later
    request_interval = 1.1  # stay well under the API's per-minute limit

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key
        self._cache: dict[tuple[str, date | None], list[dict[str, Any]]] = {}

    def client(self) -> httpx.Client:
        key = self._api_key or require(get_settings().gie_api_key, "GIE_API_KEY")
        return make_client({"x-key": key})

    def _area_rows(
        self, client: httpx.Client, area: str, since: date | None
    ) -> list[dict[str, Any]]:
        if (area, since) not in self._cache:
            params: dict[str, Any] = {"size": PAGE_SIZE}
            params.update(area_params(area))
            if since is not None:
                params["from"] = since.isoformat()
            rows: list[dict[str, Any]] = []
            page = 1
            while True:
                body = get_json(client, self.url, {**params, "page": page})
                rows += body.get("data", [])
                if page >= int(body.get("last_page") or 1):
                    break
                page += 1
                time.sleep(self.request_interval)
            self._cache[(area, since)] = rows
        return self._cache[(area, since)]

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        area, field = spec.source_ref.split("|")
        return parse_rows(self._area_rows(client, area, since), field, spec.code)


class GieAgsiSource(GieSource):
    name = "gie_agsi"
    url = AGSI_URL


class GieAlsiSource(GieSource):
    name = "gie_alsi"
    url = ALSI_URL
