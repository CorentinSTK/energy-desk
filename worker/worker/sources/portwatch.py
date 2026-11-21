"""IMF PortWatch: daily transit calls through maritime chokepoints, and disruption events.

Both come from PortWatch's public ArcGIS services (checked live on 2026-11-20):
- Daily_Chokepoints_Data: one row per chokepoint and day, with `date` as a "YYYY-MM-DD" string and
  counts (`n_total`, `n_tanker`) and IMF tonnage estimates (`capacity_tanker`). `source_ref` is
  "<chokepoint id>|<field>"; one query per chokepoint serves its three series.
- portwatch_disruptions_database: named events (e.g. "HORMUZ-26", Strait of Hormuz from 1 Mar 2026)
  with the ports or chokepoints they affect and dates as epoch milliseconds. Events touching the
  catalogue's chokepoints are written to market.shipping_events by `persist`.

ArcGIS returns at most 2,000 rows per query and sets `exceededTransferLimit` when more remain, so
queries page with `resultOffset`. Errors come back as HTTP 200 with an `error` object.
Licence: IMF terms; automated access was requested from the IMF and is used meanwhile (ADR 0013).
"""

import html
import re
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
import psycopg

from worker.catalog import SeriesSpec, load_catalog
from worker.http_client import get_json
from worker.sources.base import Source
from worker.validate import Observation

SERVICES = "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services"
TRANSITS_URL = f"{SERVICES}/Daily_Chokepoints_Data/FeatureServer/0/query"
EVENTS_URL = f"{SERVICES}/portwatch_disruptions_database/FeatureServer/0/query"
PAGE_SIZE = 2000
FIELDS = ("n_total", "n_tanker", "capacity_tanker")
CHOKEPOINT_ID = re.compile(r"^chokepoint\d{1,3}$")


class ArcGisError(RuntimeError):
    """The service answered with an error object instead of features."""


def query_all(client: httpx.Client, url: str, params: dict[str, Any], interval: float) -> list[Any]:
    """Every feature's attributes for a query, following ArcGIS paging."""
    rows: list[Any] = []
    offset = 0
    while True:
        page = {**params, "f": "json", "resultOffset": offset, "resultRecordCount": PAGE_SIZE}
        body = get_json(client, url, page)
        if "error" in body:
            raise ArcGisError(f"PortWatch query failed: {body['error']}")
        features = body.get("features", [])
        rows.extend(feature["attributes"] for feature in features)
        if not body.get("exceededTransferLimit") or not features:
            return rows
        offset += len(features)
        time.sleep(interval)


def split_ref(spec: SeriesSpec) -> tuple[str, str]:
    chokepoint, field = spec.source_ref.split("|")
    if not CHOKEPOINT_ID.match(chokepoint) or field not in FIELDS:
        raise ValueError(f"{spec.code}: unexpected PortWatch source_ref {spec.source_ref!r}")
    return chokepoint, field


def parse_rows(rows: list[dict[str, Any]], spec: SeriesSpec) -> list[Observation]:
    """Daily values of one field; a missing value is skipped, never filled."""
    _, field = split_ref(spec)
    observations = []
    for row in rows:
        value = row.get(field)
        if value is None:
            continue
        day = date.fromisoformat(row["date"])
        ts = datetime(day.year, day.month, day.day, tzinfo=UTC)
        observations.append(Observation(spec.code, ts, float(value)))
    return sorted(observations, key=lambda o: o.ts)


@dataclass(frozen=True)
class ShippingEvent:
    event_id: str
    name: str
    description: str | None
    alert_level: str | None
    chokepoints: tuple[str, ...]
    starts_on: date
    ends_on: date | None


def _epoch_ms_to_date(value: Any) -> date | None:
    if value in (None, ""):
        return None
    return datetime.fromtimestamp(int(value) / 1000, tz=UTC).date()


def _plain_text(value: Any) -> str | None:
    if not value:
        return None
    text = html.unescape(re.sub(r"<[^>]+>", " ", str(value)))
    return re.sub(r"\s+", " ", text).strip() or None


def parse_events(rows: list[dict[str, Any]], chokepoints: set[str]) -> list[ShippingEvent]:
    """Events that affect at least one of `chokepoints`, keeping only those chokepoints."""
    events = []
    for row in rows:
        affected = [p.strip() for p in str(row.get("affectedports") or "").split(";")]
        touched = tuple(sorted(p for p in affected if p in chokepoints))
        starts_on = _epoch_ms_to_date(row.get("fromdate"))
        if not touched or starts_on is None:
            continue
        events.append(
            ShippingEvent(
                event_id=str(row["eventid"]),
                name=_plain_text(row.get("htmlname")) or str(row.get("eventname")),
                description=_plain_text(row.get("htmldescription")),
                alert_level=row.get("alertlevel") or None,
                chokepoints=touched,
                starts_on=starts_on,
                ends_on=_epoch_ms_to_date(row.get("todate")),
            )
        )
    return events


class PortWatchSource(Source):
    name = "portwatch"
    lookback = timedelta(days=14)  # recent days are revised as late AIS signals arrive
    request_interval = 1.0

    def __init__(self) -> None:
        self._rows: dict[tuple[str, date | None], list[dict[str, Any]]] = {}
        self._events: list[ShippingEvent] | None = None

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        chokepoint, _ = split_ref(spec)
        key = (chokepoint, since)
        if key not in self._rows:
            where = f"portid='{chokepoint}'"
            if since is not None:
                where += f" and date >= '{since.isoformat()}'"
            params = {"where": where, "outFields": "date," + ",".join(FIELDS)}
            self._rows[key] = query_all(client, TRANSITS_URL, params, self.request_interval)
        if self._events is None:
            self._events = self._fetch_events(client)
        return parse_rows(self._rows[key], spec)

    def _fetch_events(self, client: httpx.Client) -> list[ShippingEvent]:
        chokepoints = {split_ref(s)[0] for s in load_catalog(self.name).series}
        params = {
            "where": "affectedports like '%chokepoint%'",
            "outFields": "eventid,eventname,htmlname,htmldescription,alertlevel,affectedports,"
            "fromdate,todate",
            "returnGeometry": "false",
        }
        return parse_events(
            query_all(client, EVENTS_URL, params, self.request_interval), chokepoints
        )

    def persist(self, conn: psycopg.Connection) -> int:
        """Disruption events → market.shipping_events, updated as PortWatch revises them."""
        if not self._events:
            return 0
        with conn.cursor() as cur:
            cur.executemany(
                """
                insert into market.shipping_events
                    (event_id, name, description, alert_level, chokepoints, starts_on, ends_on)
                values (%s, %s, %s, %s, %s, %s, %s)
                on conflict (event_id) do update set
                    name = excluded.name, description = excluded.description,
                    alert_level = excluded.alert_level, chokepoints = excluded.chokepoints,
                    starts_on = excluded.starts_on, ends_on = excluded.ends_on,
                    ingested_at = now()
                """,
                [
                    (
                        e.event_id,
                        e.name,
                        e.description,
                        e.alert_level,
                        list(e.chokepoints),
                        e.starts_on,
                        e.ends_on,
                    )
                    for e in self._events
                ],
            )
        return len(self._events)
