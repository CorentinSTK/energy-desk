"""ODRÉ éCO2mix (RTE, Opendatasoft API): French consumption, generation and exchanges (no key).

`source_ref` is the éCO2mix column, e.g. "consommation", "nucleaire", "ech_comm_angleterre". Every
series is stored per complete Europe/Paris day as the average power in MW (worker.power).

Checked live on 2026-10-29:
- Two datasets: `eco2mix-national-cons-def` (consolidated, then definitive data; 2012 to the end of
  the last consolidated month) and `eco2mix-national-tr` (real-time data, a rolling window of about
  60 days). For any half-hour present in both, the consolidated value wins; real-time values are
  replaced when the consolidated month is published, which is why the lookback is long.
- Values are MW. Consolidated data has a value every 30 minutes (the :15 and :45 rows are empty);
  real-time data every 15 minutes. Points are averaged in 30-minute slots, so both count the same.
- Some columns come back as strings ("2431"); null is a missing value.
- `ech_physiques` and `ech_comm_*` are net imports: negative means France exports.
- `/exports/json` returns every matching row (the `/records` endpoint stops at 10,000), so history
  is fetched one calendar year per request.
- Licence: Licence Ouverte v2.0 (Etalab), shown in the dataset metadata.
"""

from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from worker.catalog import SeriesSpec
from worker.http_client import get_json
from worker.power import Point, daily_means, day_bounds, day_ts
from worker.sources.base import Source
from worker.validate import Observation

BASE_URL = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets"
CONSOLIDATED = "eco2mix-national-cons-def"
REAL_TIME = "eco2mix-national-tr"
TZ = ZoneInfo("Europe/Paris")
SLOT = timedelta(minutes=30)
HISTORY_START = date(2015, 1, 1)  # matches the weather history used by the demand forecast (M6)
COLUMNS = (
    "consommation",
    "nucleaire",
    "eolien",
    "solaire",
    "hydraulique",
    "gaz",
    "charbon",
    "fioul",
    "bioenergies",
    "ech_physiques",
    "ech_comm_angleterre",
    "ech_comm_espagne",
    "ech_comm_italie",
    "ech_comm_suisse",
    "ech_comm_allemagne_belgique",
)


def year_windows(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    """[start, end) split at 1 January (UTC), one export request each."""
    windows = []
    while start < end:
        boundary = datetime(start.year + 1, 1, 1, tzinfo=UTC)
        windows.append((start, min(boundary, end)))
        start = boundary
    return windows


# RTE's marker for a value that is not available (found once in 2015 consolidated data, in the
# Germany-Belgium commercial exchange): a missing value, never a number.
NOT_AVAILABLE = {"", "ND"}


def parse_rows(rows: list[dict[str, Any]]) -> dict[str, list[Point]]:
    """Points per column. Empty and "ND" values are skipped: that day is a gap for that column only.

    Some columns come as numeric strings ("4409"); any other text fails loudly, naming the column
    and the time.
    """
    points: dict[str, list[Point]] = {column: [] for column in COLUMNS}
    for row in rows:
        ts = datetime.fromisoformat(row["date_heure"]).astimezone(UTC)
        for column in COLUMNS:
            value = row.get(column)
            if value is None or value in NOT_AVAILABLE:
                continue
            try:
                points[column].append((ts, float(value)))
            except ValueError as error:
                raise ValueError(
                    f"{column} at {row['date_heure']}: unexpected value {value!r}"
                ) from error
    return points


def slot_of(ts: datetime) -> float:
    epoch = ts.timestamp()
    return epoch - epoch % SLOT.total_seconds()


def merge(consolidated: list[Point], real_time: list[Point]) -> list[Point]:
    """Consolidated points, plus real-time points for the half-hours consolidated data lacks."""
    covered = {slot_of(ts) for ts, _ in consolidated}
    return consolidated + [(ts, v) for ts, v in real_time if slot_of(ts) not in covered]


class OdreSource(Source):
    name = "odre"
    lookback = timedelta(days=100)  # consolidated months replace real-time data weeks later
    request_interval = 0

    def __init__(self) -> None:
        self._cache: dict[date, dict[str, list[Point]]] = {}

    def _export(
        self, client: httpx.Client, dataset: str, start: datetime, end: datetime
    ) -> list[dict[str, Any]]:
        rows = get_json(
            client,
            f"{BASE_URL}/{dataset}/exports/json",
            {
                "select": ",".join(("date_heure", *COLUMNS)),
                "where": (
                    f"date_heure >= '{start.isoformat()}' and date_heure < '{end.isoformat()}'"
                ),
            },
        )
        if not isinstance(rows, list):
            raise ValueError(f"{dataset}: expected a list of rows, got {type(rows).__name__}")
        return rows

    def _points(self, client: httpx.Client, since: date) -> dict[str, list[Point]]:
        if since not in self._cache:
            start, _ = day_bounds(since, TZ)
            end = datetime.now(UTC) + timedelta(days=2)
            consolidated: list[dict[str, Any]] = []
            for window in year_windows(start, end):
                consolidated.extend(self._export(client, CONSOLIDATED, *window))
            by_dataset = parse_rows(consolidated)
            real_time = parse_rows(self._export(client, REAL_TIME, start, end))
            self._cache[since] = {
                column: merge(by_dataset[column], real_time[column]) for column in COLUMNS
            }
        return self._cache[since]

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        if spec.source_ref not in COLUMNS:
            raise ValueError(f"{spec.code}: unknown éCO2mix column {spec.source_ref!r}")
        start = max(since or HISTORY_START, HISTORY_START)
        points = self._points(client, start)[spec.source_ref]
        return [
            Observation(spec.code, day_ts(day), value)
            for day, value in daily_means(points, TZ, SLOT).items()
            if day >= start
        ]
