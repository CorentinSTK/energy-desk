from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.portwatch import (
    EVENTS_URL,
    TRANSITS_URL,
    ArcGisError,
    PortWatchSource,
    parse_events,
    parse_rows,
)

CATALOG = load_catalog("portwatch")
TANKERS = next(s for s in CATALOG.series if s.code == "portwatch.hormuz.tanker_transits")
TONNES = next(s for s in CATALOG.series if s.code == "portwatch.hormuz.tanker_tonnes")

# Trimmed from real answers (2026-11-20).
HORMUZ_EVENT = {
    "eventid": "10000004",
    "eventname": "HORMUZ-26",
    "htmlname": "Trade Disruptions in the Strait of Hormuz",
    "htmldescription": "Trade Disruptions in the Strait of Hormuz from: 01 Mar 2026  to: - .",
    "alertlevel": "RED",
    "affectedports": "chokepoint6",
    "fromdate": "1772323200000",
    "todate": None,
}


def row(day: str, n_tanker: int | None, tonnes: float | None = 0) -> dict[str, Any]:
    return {"date": day, "n_total": 2, "n_tanker": n_tanker, "capacity_tanker": tonnes}


def test_catalogue_covers_eight_chokepoints_with_three_series_each() -> None:
    refs = {s.source_ref.split("|")[0] for s in CATALOG.series}
    assert len(refs) == 8 and len(CATALOG.series) == 24
    assert all(s.commodity == "freight" for s in CATALOG.series)


def test_parse_rows_reads_one_field_and_skips_missing_values() -> None:
    rows = [row("2026-11-13", 0), row("2026-11-12", 1, 32117), row("2026-11-14", None)]
    tankers = parse_rows(rows, TANKERS)
    assert [(o.ts, o.value) for o in tankers] == [
        (datetime(2026, 11, 12, tzinfo=UTC), 1.0),
        (datetime(2026, 11, 13, tzinfo=UTC), 0.0),
    ]
    assert [o.value for o in parse_rows(rows, TONNES)] == [32117.0, 0.0, 0.0]


def test_events_keep_only_catalogue_chokepoints_and_open_ends() -> None:
    port_strike = {**HORMUZ_EVENT, "eventid": "1", "affectedports": "port812; port815"}
    events = parse_events([HORMUZ_EVENT, port_strike], {"chokepoint6", "chokepoint1"})
    assert len(events) == 1
    event = events[0]
    assert event.code == "HORMUZ-26"
    assert event.name == "Trade Disruptions in the Strait of Hormuz"
    assert event.chokepoints == ("chokepoint6",)
    assert event.starts_on == date(2026, 3, 1)
    assert event.ends_on is None
    assert event.alert_level == "RED"


@respx.mock
def test_fetch_pages_and_serves_three_series_from_one_query() -> None:
    def transits(request: httpx.Request) -> httpx.Response:
        offset = int(request.url.params["resultOffset"])
        if offset == 0:
            return httpx.Response(
                200,
                json={
                    "features": [{"attributes": row("2026-11-12", 1)}],
                    "exceededTransferLimit": True,
                },
            )
        return httpx.Response(200, json={"features": [{"attributes": row("2026-11-13", 0)}]})

    route = respx.get(TRANSITS_URL).mock(side_effect=transits)
    respx.get(EVENTS_URL).mock(
        return_value=httpx.Response(200, json={"features": [{"attributes": HORMUZ_EVENT}]})
    )
    source = PortWatchSource()
    source.request_interval = 0
    with make_client() as client:
        tankers = source.fetch(client, TANKERS, date(2026, 11, 6))
        tonnes = source.fetch(client, TONNES, date(2026, 11, 6))
    assert [o.value for o in tankers] == [1.0, 0.0]
    assert len(tonnes) == 2
    assert route.call_count == 2  # two pages, shared by both series
    where = route.calls[0].request.url.params["where"]
    assert where == "portid='chokepoint6' and date >= '2026-11-06'"


@respx.mock
def test_an_error_object_is_a_failure_not_an_empty_result() -> None:
    respx.get(TRANSITS_URL).mock(
        return_value=httpx.Response(200, json={"error": {"code": 400, "message": "Invalid query"}})
    )
    source = PortWatchSource()
    with make_client() as client, pytest.raises(ArcGisError):
        source.fetch(client, TANKERS, None)
