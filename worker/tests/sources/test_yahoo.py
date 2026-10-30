from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import SourceHTTPError, make_client
from worker.sources.yahoo import YahooSource, parse_chart

SPECS = {s.code: s for s in load_catalog("yahoo").series}


def chart(points: list[tuple[datetime, float | None]]) -> dict[str, Any]:
    return {
        "chart": {
            "result": [
                {
                    "meta": {"exchangeTimezoneName": "America/New_York"},
                    "timestamp": [int(ts.timestamp()) for ts, _ in points],
                    "indicators": {"quote": [{"close": [v for _, v in points]}]},
                }
            ]
        }
    }


def test_closes_are_dated_in_the_exchange_time_zone() -> None:
    # 03:00 UTC on 29 Oct is 23:00 on 28 Oct in New York (EDT, UTC-4).
    body = chart(
        [
            (datetime(2026, 10, 29, 3, tzinfo=UTC), 99.0),
            (datetime(2026, 10, 30, 3, tzinfo=UTC), None),
        ]
    )
    assert parse_chart(body) == [(date(2026, 10, 28), 99.0)]


def test_a_live_quote_dated_like_the_last_bar_is_dropped() -> None:
    # Seen on CL=F (2026-10-30): the daily bar for 29 Oct, then a live quote also on 29 Oct.
    body = chart(
        [
            (datetime(2026, 10, 29, 4, tzinfo=UTC), 102.0),
            (datetime(2026, 10, 30, 1, tzinfo=UTC), 103.37),
        ]
    )
    assert parse_chart(body) == [(date(2026, 10, 29), 102.0)]


@respx.mock
def test_rate_limit_is_not_retried() -> None:
    route = respx.get(url__regex=r"https://query1\.finance\.yahoo\.com/.*").mock(
        return_value=httpx.Response(429)
    )
    source = YahooSource(today=lambda: date(2026, 10, 28))
    with make_client() as client, pytest.raises(SourceHTTPError) as caught:
        source.fetch(client, SPECS["yahoo.ttf.front_month"], date(2026, 10, 1))
    assert caught.value.status_code == 429
    assert route.call_count == 1


@respx.mock
def test_unlisted_contracts_are_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("worker.sources.yahoo.time.sleep", lambda _s: None)
    day = datetime(2026, 10, 28, 20, tzinfo=UTC)

    def answer(request: httpx.Request) -> httpx.Response:
        if "TTFX26" in request.url.path:
            return httpx.Response(200, json=chart([(day, 99.3)]))
        if "TTFZ26" in request.url.path:
            return httpx.Response(200, json=chart([(day, 99.1)]))
        return httpx.Response(404, json={"chart": {"result": None}})

    respx.get(url__regex=r"https://query1\.finance\.yahoo\.com/.*").mock(side_effect=answer)
    source = YahooSource(today=lambda: date(2026, 10, 28))
    with make_client() as client:
        observations = source.fetch(client, SPECS["yahoo.ttf.m1_m2_spread"], None)
    assert [(o.ts.date(), round(o.value, 2)) for o in observations] == [(date(2026, 10, 28), 0.2)]


@respx.mock
def test_oil_curve_spreads_follow_the_expiry_rule(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("worker.sources.yahoo.time.sleep", lambda _s: None)
    day = datetime(2026, 10, 30, 20, tzinfo=UTC)
    closes = {"CLZ26": 103.55, "CLF27": 101.63, "CLG27": 99.43}

    def answer(request: httpx.Request) -> httpx.Response:
        for ticker, close in closes.items():
            if ticker in request.url.path:
                return httpx.Response(200, json=chart([(day, close)]))
        return httpx.Response(404, json={"chart": {"result": None}})

    route = respx.get(url__regex=r"https://query1\.finance\.yahoo\.com/.*").mock(side_effect=answer)
    source = YahooSource(today=lambda: date(2026, 10, 30))
    with make_client() as client:
        m2 = source.fetch(client, SPECS["yahoo.cl.m1_m2"], None)
        m3 = source.fetch(client, SPECS["yahoo.cl.m1_m3"], None)
        m12 = source.fetch(client, SPECS["yahoo.cl.m1_m12"], None)
    assert [(o.ts.date(), round(o.value, 2)) for o in m2] == [(date(2026, 10, 30), 1.92)]
    assert [round(o.value, 2) for o in m3] == [4.12]
    assert m12 == []  # December 2027 not settled in this fixture: no value
    # CLX26 (one before the front) to CLN27 (M12), requested once for all CL spreads.
    assert route.call_count == 13
