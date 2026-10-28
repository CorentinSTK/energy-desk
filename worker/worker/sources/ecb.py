"""ECB reference exchange rates (ECB Data Portal, no key).

API: https://data-api.ecb.europa.eu/service/data/EXR/<key>?format=csvdata&detail=dataonly&startPeriod=…
`source_ref` is the series key without the dataflow, e.g. `D.USD.EUR.SP00.A` (USD per 1 EUR, daily).
Rates are published on TARGET business days around 16:00 CET; there are no weekend values.

Checked live on 2026-10-28:
- A period with no data returns HTTP 200 with an empty body.
- The portal's firewall answers bursts of requests with an HTML "access blocked" page (HTTP 400).
  That page must never be read as "no data", so the CSV header is checked before parsing.
"""

import csv
import io
from datetime import UTC, date, datetime

import httpx

from worker.catalog import SeriesSpec
from worker.http_client import get
from worker.sources.base import Source
from worker.validate import Observation

BASE_URL = "https://data-api.ecb.europa.eu/service/data/EXR"
REQUIRED_COLUMNS = {"TIME_PERIOD", "OBS_VALUE"}


class UnexpectedResponse(Exception):
    pass


def parse_csv(text: str, series_code: str) -> list[Observation]:
    """Parse an ECB CSV response. Empty body = no data. Rows with an empty value are skipped."""
    if not text.strip():
        return []
    reader = csv.DictReader(io.StringIO(text))
    if not set(reader.fieldnames or []) >= REQUIRED_COLUMNS:
        raise UnexpectedResponse(f"Not an ECB CSV response (starts with {text[:60]!r})")
    observations = []
    for row in reader:
        value = (row.get("OBS_VALUE") or "").strip()
        if not value:
            continue
        day = date.fromisoformat(row["TIME_PERIOD"])
        ts = datetime(day.year, day.month, day.day, tzinfo=UTC)
        observations.append(Observation(series_code, ts, float(value)))
    return observations


class EcbSource(Source):
    name = "ecb"

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        params = {"format": "csvdata", "detail": "dataonly"}
        if since is not None:
            params["startPeriod"] = since.isoformat()
        response = get(client, f"{BASE_URL}/{spec.source_ref}", params)
        return parse_csv(response.text, spec.code)
