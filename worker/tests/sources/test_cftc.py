from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.cftc import URL, CftcSource, UnitMismatch, parse_rows

SPECS = {s.code: s for s in load_catalog("cftc").series}
LONG = SPECS["cftc.wti.managed_money_long"]
SHORT = SPECS["cftc.wti.swap_short"]


def row(day: str, **values: str) -> dict[str, Any]:
    # Trimmed from a real response (2026-10-30).
    return {
        "report_date_as_yyyy_mm_dd": f"{day}T00:00:00.000",
        "contract_units": "(CONTRACTS OF 1,000 BARRELS)",
        "m_money_positions_long_all": "163413",
        "swap__positions_short_all": "606648",
        **values,
    }


def test_parse_rows_reads_the_field_named_in_the_reference() -> None:
    rows = [row("2026-10-20")]
    assert [(o.ts, o.value) for o in parse_rows(rows, LONG)] == [
        (datetime(2026, 10, 20, tzinfo=UTC), 163413.0)
    ]
    assert [o.value for o in parse_rows(rows, SHORT)] == [606648.0]


def test_missing_values_are_skipped_and_unit_changes_fail() -> None:
    assert parse_rows([row("2026-10-20", m_money_positions_long_all="")], LONG) == []
    with pytest.raises(UnitMismatch):
        parse_rows([row("2026-10-20", contract_units="(CONTRACTS OF 500 BARRELS)")], LONG)


@respx.mock
def test_one_request_per_market_serves_every_field() -> None:
    route = respx.get(URL).mock(
        return_value=httpx.Response(200, json=[row("2026-10-13"), row("2026-10-20")])
    )
    source = CftcSource()
    with make_client() as client:
        longs = source.fetch(client, LONG, date(2026, 10, 1))
        shorts = source.fetch(client, SHORT, date(2026, 10, 1))
    assert len(longs) == len(shorts) == 2
    assert route.call_count == 1
    where = route.calls[0].request.url.params["$where"]
    assert "cftc_contract_market_code='067651'" in where
    assert "report_date_as_yyyy_mm_dd >= '2026-10-01T00:00:00'" in where
