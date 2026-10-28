from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import SourceHTTPError, make_client
from worker.sources.yahoo import (
    YahooSource,
    add_months,
    contract_ticker,
    m1_m2_spread,
    parse_chart,
)

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


def test_contract_tickers_and_month_arithmetic() -> None:
    assert contract_ticker("TTF", date(2026, 12, 1)) == "TTFZ26.NYM"
    assert contract_ticker("TTF", date(2027, 1, 1)) == "TTFF27.NYM"
    assert add_months(date(2026, 11, 28), 2) == date(2027, 1, 1)


def test_closes_are_dated_in_the_exchange_time_zone() -> None:
    # 03:00 UTC on 29 Oct is 23:00 on 28 Oct in New York (EDT, UTC-4).
    body = chart(
        [
            (datetime(2026, 10, 29, 3, tzinfo=UTC), 99.0),
            (datetime(2026, 10, 30, 3, tzinfo=UTC), None),
        ]
    )
    assert parse_chart(body) == [(date(2026, 10, 28), 99.0)]


def test_spread_uses_the_next_two_delivery_months_strictly() -> None:
    nov, dec, jan = date(2026, 11, 1), date(2026, 12, 1), date(2027, 1, 1)
    settles = {
        nov: {date(2026, 10, 28): 99.3, date(2026, 9, 15): 90.0},
        dec: {date(2026, 10, 28): 99.1, date(2026, 9, 15): 91.0, date(2026, 11, 3): 98.0},
        jan: {date(2026, 11, 3): 97.0},
    }
    spread = dict(m1_m2_spread(settles))
    assert spread[date(2026, 10, 28)] == pytest.approx(0.2)  # Nov - Dec
    assert spread[date(2026, 11, 3)] == pytest.approx(1.0)  # Dec - Jan
    # 15 Sep: M1 is October, which is not listed — no value, never "Nov - Dec" relabelled as M1-M2.
    assert date(2026, 9, 15) not in spread


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
