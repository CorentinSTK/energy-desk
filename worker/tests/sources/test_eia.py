from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.eia import BASE_URL, EiaSource, UnitMismatch, parse_rows

SPEC = next(s for s in load_catalog("eia").series if s.code == "eia.wti_spot")


def row(period: str, value: str | None, units: str = "$/BBL") -> dict[str, Any]:
    # Trimmed from a real response (2026-10-28).
    return {"period": period, "series": "RWTC", "value": value, "units": units}


def test_parse_rows_skips_null_values() -> None:
    observations = parse_rows([row("2026-10-19", "110.01"), row("2026-10-20", None)], SPEC)
    assert [(o.ts, o.value) for o in observations] == [(datetime(2026, 10, 19, tzinfo=UTC), 110.01)]


def test_unit_change_at_the_provider_fails_loudly() -> None:
    with pytest.raises(UnitMismatch):
        parse_rows([row("2026-10-19", "110.01", units="$/GAL")], SPEC)


@respx.mock
def test_fetch_pages_until_total() -> None:
    def page(request: httpx.Request) -> httpx.Response:
        offset = int(request.url.params["offset"])
        rows = [row("2026-10-19", "110.0")] if offset == 0 else [row("2026-10-20", "107.9")]
        return httpx.Response(200, json={"response": {"total": "2", "data": rows}})

    route = respx.get(f"{BASE_URL}/petroleum/pri/spt/data/").mock(side_effect=page)
    source = EiaSource(api_key="test")
    source.request_interval = 0
    with make_client() as client:
        observations = source.fetch(client, SPEC, date(2026, 10, 19))
    assert [o.value for o in observations] == [110.0, 107.9]
    assert route.call_count == 2
    params = route.calls[0].request.url.params
    assert params["facets[series][]"] == "RWTC"
    assert params["start"] == "2026-10-19"
    assert params["frequency"] == "daily"
