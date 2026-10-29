from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources import elexon
from worker.sources.elexon import (
    MID_URL,
    STREAM_URLS,
    ElexonSource,
    parse_mid,
    parse_stream,
    windows,
)

SPECS = {s.code: s for s in load_catalog("elexon").series}
# 28 October 2026 is a 48-period day in Europe/London (GMT).
DAY_START = datetime(2026, 10, 28, tzinfo=UTC)


@pytest.fixture(autouse=True)
def no_pause(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(elexon, "WINDOW_INTERVAL", 0)


def mid_row(i: int, **overrides: Any) -> dict[str, Any]:
    # Shape of a real response (2026-10-27).
    row = {
        "startTime": (DAY_START + timedelta(minutes=30 * i)).isoformat().replace("+00:00", "Z"),
        "dataProvider": "APXMIDP",
        "price": 80.0,
        "volume": 2660.7,
    }
    return {**row, **overrides}


def test_mid_ignores_n2ex_and_periods_without_trades() -> None:
    points = parse_mid(
        [
            mid_row(0),
            mid_row(1, dataProvider="N2EXMIDP", price=0.0, volume=0.0),
            mid_row(2, volume=0),
        ]
    )
    assert points == [(DAY_START, 80.0)]


def test_mid_windows_stay_within_the_seven_day_limit() -> None:
    result = windows(date(2026, 10, 1), date(2026, 10, 20), timedelta(days=6))
    assert result == [
        (date(2026, 10, 1), date(2026, 10, 7)),
        (date(2026, 10, 8), date(2026, 10, 14)),
        (date(2026, 10, 15), date(2026, 10, 20)),
    ]
    assert all((last - first).days < 7 for first, last in result)


def test_latest_publication_wins() -> None:
    start = "2026-10-28T00:00:00Z"
    rows = [
        {
            "startTime": start,
            "publishTime": "2026-10-28T00:30:00Z",
            "fuelType": "WIND",
            "generation": 1,
        },
        {
            "startTime": start,
            "publishTime": "2026-10-29T00:30:00Z",
            "fuelType": "WIND",
            "generation": 2,
        },
        {
            "startTime": start,
            "publishTime": "2026-10-28T00:30:00Z",
            "fuelType": "CCGT",
            "generation": 3,
        },
    ]
    points = parse_stream(rows, "fuelhh")
    assert points["WIND"] == [(DAY_START, 2.0)]
    assert points["CCGT"] == [(DAY_START, 3.0)]


def test_demand_fields_are_split() -> None:
    row = {
        "startTime": "2026-10-28T00:00:00Z",
        "publishTime": "2026-10-28T00:30:00Z",
        "initialDemandOutturn": 23001,
        "initialTransmissionSystemDemandOutturn": 28414,
    }
    points = parse_stream([row], "demand")
    assert points["initialDemandOutturn"] == [(DAY_START, 23001.0)]


@respx.mock
def test_daily_mid_needs_every_period_and_shares_the_download() -> None:
    day = [mid_row(i, price=float(i)) for i in range(48)]
    partial_next_day = [mid_row(48 + i) for i in range(10)]
    route = respx.get(MID_URL).mock(
        return_value=httpx.Response(200, json={"data": day + partial_next_day})
    )
    source = ElexonSource()
    with make_client() as client:
        half_hourly = source.fetch(client, SPECS["elexon.gb.mid"], date(2026, 10, 28))
        daily = source.fetch(client, SPECS["elexon.gb.mid_base"], date(2026, 10, 28))
    assert route.call_count >= 1
    calls = route.call_count
    assert len(half_hourly) == 58
    assert [(o.ts, o.value) for o in daily] == [(DAY_START, 23.5)]
    assert route.call_count == calls  # the second series reused the download
    assert route.calls[0].request.url.params["dataProviders"] == "APXMIDP"


@respx.mock
def test_generation_by_fuel_is_a_daily_average() -> None:
    rows = [
        {
            "startTime": (DAY_START + timedelta(minutes=30 * i)).isoformat(),
            "publishTime": "2026-10-29T00:00:00Z",
            "fuelType": fuel,
            "generation": value,
        }
        for i in range(48)
        for fuel, value in (("WIND", 10000), ("INTFR", -1500))
    ]
    route = respx.get(STREAM_URLS["fuelhh"]).mock(return_value=httpx.Response(200, json=rows))
    source = ElexonSource()
    with make_client() as client:
        wind = source.fetch(client, SPECS["elexon.gb.gen.wind"], date(2026, 10, 28))
        ifa = source.fetch(client, SPECS["elexon.gb.int.ifa"], date(2026, 10, 28))
    assert [o.value for o in wind] == [10000.0]
    assert [o.value for o in ifa] == [-1500.0]  # negative: GB exports
    assert route.call_count == 1


def test_unknown_dataset_fails_loudly() -> None:
    spec = SPECS["elexon.gb.demand"].model_copy(update={"source_ref": "b1610|x"})
    with make_client() as client, pytest.raises(ValueError, match="unknown Elexon dataset"):
        ElexonSource().fetch(client, spec, None)
