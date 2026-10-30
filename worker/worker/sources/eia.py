"""U.S. Energy Information Administration, API v2 (free key).

`source_ref` is "<route>|<series id>", e.g. "petroleum/pri/spt|RWTC": the request goes to
https://api.eia.gov/v2/<route>/data/ with the series facet (`series`, or `seriesId` for STEO).
"derived|<name>" is a crack spread computed from catalogued EIA spot series (worker/oil.py).

Checked live on 2026-10-28 and 2026-10-30:
- At most 5,000 rows per request: responses are paged with `offset` until `total` is reached.
- Values come as strings; a null value is a missing observation and is skipped.
- Each row carries its unit ("units", or "unit" for STEO); it must match the catalogue's
  `source_unit`.
- Weekly and daily periods are "YYYY-MM-DD"; monthly periods are "YYYY-MM" (stored on the 1st).
- STEO series run into the forecast horizon (to December of next year) with nothing marking where
  history ends. Only months before the current month are kept: forecasts are not observations.
"""

import time
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any

import httpx

from worker import oil
from worker.catalog import SeriesSpec, load_catalog
from worker.config import get_settings, require
from worker.http_client import get_json
from worker.sources.base import Source
from worker.validate import Observation

BASE_URL = "https://api.eia.gov/v2"
PAGE_SIZE = 5000
# The series facet is named differently on some routes.
SERIES_FACET = {"steo": "seriesId"}
HISTORY_ONLY_ROUTES = {"steo"}

# Crack spreads: name → (formula, component source_refs in the formula's argument order).
# Components must be catalogued series.
WTI = "petroleum/pri/spt|RWTC"
BRENT = "petroleum/pri/spt|RBRTE"
GASOLINE_USGC = "petroleum/pri/spt|EER_EPMRU_PF4_RGC_DPG"
ULSD_USGC = "petroleum/pri/spt|EER_EPD2DXL0_PF4_RGC_DPG"
ULSD_NYH = "petroleum/pri/spt|EER_EPD2DXL0_PF4_Y35NY_DPG"
DERIVED: dict[str, tuple[Callable[..., dict[datetime, float]], tuple[str, ...]]] = {
    "crack_321_usgc": (oil.crack_321, (GASOLINE_USGC, ULSD_USGC, WTI)),
    "crack_ulsd_nyh_brent": (oil.product_crack, (ULSD_NYH, BRENT)),
}


class UnitMismatch(Exception):
    pass


def period_start(period: str) -> datetime:
    """'2026-10-23' → that day; '2026-10' (monthly) → the 1st of the month. Midnight UTC."""
    day = date.fromisoformat(period if len(period) > 7 else f"{period}-01")
    return datetime(day.year, day.month, day.day, tzinfo=UTC)


def parse_rows(rows: list[dict[str, Any]], spec: SeriesSpec) -> list[Observation]:
    observations = []
    for row in rows:
        unit = row.get("units", row.get("unit"))
        if spec.source_unit is not None and unit != spec.source_unit:
            raise UnitMismatch(f"{spec.code}: expected {spec.source_unit!r}, got {unit!r}")
        if row.get("value") in (None, ""):
            continue
        observations.append(
            Observation(spec.code, period_start(row["period"]), float(row["value"]))
        )
    return observations


def history_only(observations: list[Observation], today: date) -> list[Observation]:
    """Months before the current one (STEO: the rest is EIA's forecast, not an observation)."""
    current_month = datetime(today.year, today.month, 1, tzinfo=UTC)
    return [o for o in observations if o.ts < current_month]


def derive(name: str, code: str, components: list[dict[datetime, float]]) -> list[Observation]:
    formula, _ = DERIVED[name]
    return [Observation(code, ts, v) for ts, v in formula(*components).items()]


class EiaSource(Source):
    name = "eia"

    def __init__(self, api_key: str | None = None, today: Callable[[], date] = date.today) -> None:
        self._api_key = api_key
        self._today = today
        # Fetched series by (source_ref, since), so crack components are requested once per run.
        self._cache: dict[tuple[str, date | None], list[Observation]] = {}
        self._specs: dict[str, SeriesSpec] | None = None

    def _spec_for(self, source_ref: str) -> SeriesSpec:
        if self._specs is None:
            self._specs = {s.source_ref: s for s in load_catalog(self.name).series}
        return self._specs[source_ref]

    def _key(self) -> str:
        return self._api_key or require(get_settings().eia_api_key, "EIA_API_KEY")

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        route, name = spec.source_ref.split("|")
        if route == "derived":
            components = []
            for ref in DERIVED[name][1]:
                fetched = self._cached(client, self._spec_for(ref), since)
                components.append({o.ts: o.value for o in fetched})
            return derive(name, spec.code, components)
        return self._cached(client, spec, since)

    def _cached(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        key = (spec.source_ref, since)
        if key not in self._cache:
            self._cache[key] = self._request(client, spec, since)
        return self._cache[key]

    def _request(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        route, series_id = spec.source_ref.split("|")
        params: dict[str, Any] = {
            "api_key": self._key(),
            "frequency": spec.frequency,
            "data[0]": "value",
            f"facets[{SERIES_FACET.get(route, 'series')}][]": series_id,
            "sort[0][column]": "period",
            "sort[0][direction]": "asc",
            "length": PAGE_SIZE,
        }
        if since is not None:
            # Monthly routes take "YYYY-MM"; a full date is rejected there.
            params["start"] = (
                since.isoformat()[:7] if spec.frequency == "monthly" else since.isoformat()
            )

        observations: list[Observation] = []
        offset = 0
        while True:
            body = get_json(client, f"{BASE_URL}/{route}/data/", {**params, "offset": offset})
            response = body["response"]
            rows = response["data"]
            observations += parse_rows(rows, spec)
            offset += len(rows)
            if not rows or offset >= int(response["total"]):
                if route in HISTORY_ONLY_ROUTES:
                    return history_only(observations, self._today())
                return observations
            time.sleep(self.request_interval)
