"""ENTSOG Transparency Platform, physical gas flows at entry points into the EU (no key).

`source_ref` is "<pointKey>|<operatorKey>|<direction>", e.g. "ITP-00045|FR-TSO-0003|entry": one
point as reported by one operator. Series are never summed across points or operators.

Checked live on 2026-10-28:
- `aggregatedData` (country totals) returns nothing; `operationalData` per point works.
- Several major points (Emden, Dornum: Norway → Germany) are reported by several operators under
  several keys with overlapping values. Adding them up would double count, so they are not used and
  are a declared gap. Only points reported by a single operator with a value are in the catalogue.
- Values are in kWh/d, per gas day (06:00 to 06:00 CET); the gas day's date is stored at 00:00 UTC,
  like GIE. Empty values are missing observations and are skipped.
- Terms (ENTSOG TP Terms and Conditions of Use, art. 5): data may be downloaded, stored and used in
  good faith; quotes must give the source and the extraction date, "ENTSOG TP [DD-MM-YYYY]
  https://transparency.entsog.eu/". The site fills the date from the last successful run.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from worker.catalog import SeriesSpec
from worker.http_client import get_json
from worker.sources.base import Source
from worker.validate import Observation

URL = "https://transparency.entsog.eu/api/v1/operationalData"
# ENTSOG history used when no start date is given (full history of these points is not needed).
DEFAULT_START = date(2015, 1, 1)


def parse_rows(rows: list[dict[str, Any]], spec: SeriesSpec) -> list[Observation]:
    """Keep rows for exactly the catalogued point, operator and direction; skip empty values."""
    point, operator, direction = spec.source_ref.split("|")
    observations = []
    for row in rows:
        if (row.get("pointKey"), row.get("operatorKey"), row.get("directionKey")) != (
            point,
            operator,
            direction,
        ):
            continue
        if row.get("value") in (None, ""):
            continue
        if spec.source_unit is not None and row.get("unit") != spec.source_unit:
            raise ValueError(f"{spec.code}: expected {spec.source_unit!r}, got {row.get('unit')!r}")
        day = date.fromisoformat(row["periodFrom"][:10])
        ts = datetime(day.year, day.month, day.day, tzinfo=UTC)
        observations.append(Observation(spec.code, ts, float(row["value"])))
    return observations


class EntsogSource(Source):
    name = "entsog"
    lookback = timedelta(days=30)  # provisional values are confirmed later
    request_interval = 1.5

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        point, operator, direction = spec.source_ref.split("|")
        body = get_json(
            client,
            URL,
            {
                "indicator": "Physical Flow",
                "periodType": "day",
                "pointKey": point,
                "operatorKey": operator,
                "directionKey": direction,
                "from": (since or DEFAULT_START).isoformat(),
                "to": (date.today() + timedelta(days=1)).isoformat(),
                "limit": -1,
            },
        )
        return parse_rows(body.get("operationalData", []), spec)
