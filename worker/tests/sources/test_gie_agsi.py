from datetime import date
from typing import Any

import httpx
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.gie_agsi import URL, GieAgsiSource, parse_rows

CATALOG = {s.code: s for s in load_catalog("gie_agsi").series}


def day(gas_day: str, storage: str, status: str = "C") -> dict[str, Any]:
    # Trimmed from a real response (2026-10-28).
    return {"gasDayStart": gas_day, "gasInStorage": storage, "full": "74.93", "status": status}


def test_dash_and_no_data_status_are_skipped() -> None:
    rows = [day("2026-10-26", "848.8181", "E"), day("2026-10-25", "-"), day("2026-10-24", "1", "N")]
    observations = parse_rows(rows, "gasInStorage", "agsi.eu.storage")
    assert [o.value for o in observations] == [848.8181]


@respx.mock
def test_eu_aggregate_uses_type_eu_and_is_fetched_once_for_all_fields() -> None:
    route = respx.get(URL).mock(
        return_value=httpx.Response(
            200, json={"last_page": 1, "data": [day("2026-10-26", "848.8")]}
        )
    )
    source = GieAgsiSource(api_key="test")
    with make_client() as client:
        storage = source.fetch(client, CATALOG["agsi.eu.storage"], date(2026, 10, 1))
        full = source.fetch(client, CATALOG["agsi.eu.full"], date(2026, 10, 1))
    assert storage[0].value == 848.8
    assert full[0].value == 74.93
    assert route.call_count == 1
    params = route.calls[0].request.url.params
    assert params["type"] == "eu"
    assert "country" not in params


@respx.mock
def test_country_request_and_pagination() -> None:
    def page(request: httpx.Request) -> httpx.Response:
        n = int(request.url.params["page"])
        return httpx.Response(
            200, json={"last_page": 2, "data": [day(f"2026-10-2{n}", str(150 + n))]}
        )

    route = respx.get(URL).mock(side_effect=page)
    source = GieAgsiSource(api_key="test")
    source.request_interval = 0
    with make_client() as client:
        observations = source.fetch(client, CATALOG["agsi.de.storage"], None)
    assert sorted(o.value for o in observations) == [151.0, 152.0]
    assert route.calls[0].request.url.params["country"] == "DE"
