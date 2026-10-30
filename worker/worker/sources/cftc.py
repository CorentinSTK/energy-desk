"""CFTC Commitments of Traders, disaggregated, futures only (Public Reporting Environment, Socrata).

`source_ref` is "<CFTC contract market code>|<field>", e.g. "067651|m_money_positions_long_all".
One request per market fetches every field at once; the series of that market share it.

Checked live on 2026-10-30:
- Dataset 72hh-3qpy. Market names changed in 2022 (e.g. "CRUDE OIL, LIGHT SWEET" became
  "WTI-PHYSICAL"); the contract market code did not, so series are addressed by code.
- One row per Tuesday (positions as of that day), published the following Friday, later in
  holiday weeks. Values are numbers of contracts, as strings. History from 13 June 2006.
- `contract_units` names the contract size; it is the same over the whole history of the three
  markets used and must match the catalogue's `source_unit`.
- Field names are irregular (e.g. `swap__positions_short_all` with two underscores).
- Terms (cftc.gov/WebPolicy, read 2026-10-30): CFTC information is public domain and may be freely
  distributed; the CFTC asks for appropriate acknowledgement.
"""

import time
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from worker.catalog import SeriesSpec
from worker.http_client import get_json
from worker.sources.base import Source
from worker.validate import Observation

URL = "https://publicreporting.cftc.gov/resource/72hh-3qpy.json"
PAGE_SIZE = 5000
DATE_FIELD = "report_date_as_yyyy_mm_dd"


class UnitMismatch(Exception):
    pass


def parse_rows(rows: list[dict[str, Any]], spec: SeriesSpec) -> list[Observation]:
    _, field = spec.source_ref.split("|")
    observations = []
    for row in rows:
        if spec.source_unit is not None and row.get("contract_units") != spec.source_unit:
            raise UnitMismatch(
                f"{spec.code}: expected {spec.source_unit!r}, got {row.get('contract_units')!r}"
            )
        if row.get(field) in (None, ""):
            continue
        day = date.fromisoformat(row[DATE_FIELD][:10])
        ts = datetime(day.year, day.month, day.day, tzinfo=UTC)
        observations.append(Observation(spec.code, ts, float(row[field])))
    return observations


class CftcSource(Source):
    name = "cftc"
    # The CFTC occasionally republishes corrected reports: re-read the last four weeks.
    lookback = timedelta(days=28)

    def __init__(self) -> None:
        self._rows: dict[tuple[str, date | None], list[dict[str, Any]]] = {}

    def _market_rows(
        self, client: httpx.Client, code: str, since: date | None
    ) -> list[dict[str, Any]]:
        key = (code, since)
        if key in self._rows:
            return self._rows[key]
        where = f"cftc_contract_market_code='{code}'"
        if since is not None:
            where += f" and {DATE_FIELD} >= '{since.isoformat()}T00:00:00'"
        rows: list[dict[str, Any]] = []
        while True:
            page = get_json(
                client,
                URL,
                {
                    "$where": where,
                    "$order": DATE_FIELD,
                    "$limit": PAGE_SIZE,
                    "$offset": len(rows),
                },
            )
            rows += page
            if len(page) < PAGE_SIZE:
                break
            time.sleep(self.request_interval)
        self._rows[key] = rows
        return rows

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        code, _ = spec.source_ref.split("|")
        return parse_rows(self._market_rows(client, code, since), spec)
