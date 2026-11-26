from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.eia import (
    BASE_URL,
    EiaSource,
    UnitMismatch,
    complete_only,
    facets,
    history_only,
    parse_rows,
)
from worker.validate import Observation

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


def test_monthly_periods_and_the_steo_unit_field() -> None:
    spec = next(s for s in load_catalog("eia").series if s.code == "eia.opec_spare_capacity")
    rows = [{"period": "2026-08", "value": ".02", "unit": "million barrels per day"}]
    assert [(o.ts, o.value) for o in parse_rows(rows, spec)] == [
        (datetime(2026, 8, 1, tzinfo=UTC), 0.02)
    ]


def test_steo_keeps_months_before_the_current_one() -> None:
    observations = [
        Observation("x", datetime(2026, m, 1, tzinfo=UTC), 1.0) for m in (8, 9, 10, 11, 12)
    ]
    kept = history_only(observations, date(2026, 10, 30))
    assert [o.ts.month for o in kept] == [8, 9]


@respx.mock
def test_steo_uses_the_series_id_facet_and_drops_forecasts() -> None:
    spec = next(s for s in load_catalog("eia").series if s.code == "eia.opec_spare_capacity")
    rows = [
        {"period": p, "value": "1.5", "unit": "million barrels per day"}
        for p in ("2026-09", "2026-10", "2027-12")
    ]
    route = respx.get(f"{BASE_URL}/steo/data/").mock(
        return_value=httpx.Response(200, json={"response": {"total": "3", "data": rows}})
    )
    source = EiaSource(api_key="test", today=lambda: date(2026, 10, 30))
    with make_client() as client:
        observations = source.fetch(client, spec, date(2026, 9, 1))
    assert [o.ts.month for o in observations] == [9]
    params = route.calls[0].request.url.params
    assert params["facets[seriesId][]"] == "COPS_OPEC"
    assert params["start"] == "2026-09"


@respx.mock
def test_crack_is_derived_from_cached_components() -> None:
    def spot(request: httpx.Request) -> httpx.Response:
        series = request.url.params["facets[series][]"]
        value, units = {
            "EER_EPMRU_PF4_RGC_DPG": ("3.101", "$/GAL"),
            "EER_EPD2DXL0_PF4_RGC_DPG": ("4.767", "$/GAL"),
            "RWTC": ("103.37", "$/BBL"),
        }[series]
        data = [{"period": "2026-10-27", "value": value, "units": units}]
        return httpx.Response(200, json={"response": {"total": "1", "data": data}})

    route = respx.get(f"{BASE_URL}/petroleum/pri/spt/data/").mock(side_effect=spot)
    specs = {s.code: s for s in load_catalog("eia").series}
    source = EiaSource(api_key="test")
    with make_client() as client:
        wti = source.fetch(client, specs["eia.wti_spot"], date(2026, 10, 27))
        crack = source.fetch(client, specs["eia.crack_321_usgc"], date(2026, 10, 27))
    assert [o.value for o in wti] == [103.37]
    assert [(o.series_code, round(o.value, 3)) for o in crack] == [("eia.crack_321_usgc", 50.196)]
    assert route.call_count == 3  # WTI was fetched once, for its own series, then reused


def test_series_refs_and_facet_refs() -> None:
    assert facets("petroleum/pri/spt", "RWTC") == {"series": "RWTC"}
    assert facets("steo", "COPS_OPEC") == {"seriesId": "COPS_OPEC"}
    assert facets(
        "electricity/rto/daily-region-data", "respondent=US48;type=D;timezone=Eastern"
    ) == {
        "respondent": "US48",
        "type": "D",
        "timezone": "Eastern",
    }


def test_eia930_rows_read_value_units() -> None:
    spec = next(s for s in load_catalog("eia").series if s.code == "eia.us48_demand")
    rows = [{"period": "2026-11-23", "value": "10978759", "value-units": "megawatthours"}]
    assert [o.value for o in parse_rows(rows, spec)] == [10978759.0]
    with pytest.raises(UnitMismatch):
        parse_rows([{**rows[0], "value-units": "megawatts"}], spec)


def test_incomplete_recent_days_are_dropped() -> None:
    spec = next(s for s in load_catalog("eia").series if s.code == "eia.us48_demand")
    assert spec.incomplete_recent_days == 2
    days = [datetime(2026, 11, d, tzinfo=UTC) for d in (22, 23, 24)]
    observations = [Observation(spec.code, ts, 1e7) for ts in days]
    kept = complete_only(observations, spec, date(2026, 11, 25))
    assert [o.ts.day for o in kept] == [22, 23]


def test_circuit_breaker_skips_after_repeated_timeouts(monkeypatch: pytest.MonkeyPatch) -> None:
    from worker.sources import eia

    source = eia.EiaSource(api_key="k", today=lambda: date(2026, 11, 26))
    calls = []

    def stalled(client, spec, since):  # type: ignore[no-untyped-def]
        calls.append(spec.code)
        raise httpx.ReadTimeout("The read operation timed out")

    monkeypatch.setattr(source, "_request", stalled)
    specs = [s for s in load_catalog("eia").series if not s.source_ref.startswith("derived")][:5]
    with make_client() as client:
        for spec in specs:
            with pytest.raises(Exception):  # noqa: B017 - timeouts, then the breaker
                source.fetch(client, spec, date(2026, 11, 1))
    assert len(calls) == eia.MAX_TIMEOUTS_IN_A_ROW
