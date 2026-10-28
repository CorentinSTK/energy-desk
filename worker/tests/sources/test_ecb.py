from datetime import UTC, date, datetime

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.ecb import BASE_URL, EcbSource, UnexpectedResponse, parse_csv

# Trimmed real response (2026-10-28), `detail=dataonly`.
CSV = """KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-10-26,1.1188
EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-10-27,1.115
"""
BLOCKED_PAGE = "<html><head><title>European Central Bank</title></head><body>blocked</body></html>"


def test_parse_csv() -> None:
    observations = parse_csv(CSV, "fx.eurusd")
    assert [(o.ts, o.value) for o in observations] == [
        (datetime(2026, 10, 26, tzinfo=UTC), 1.1188),
        (datetime(2026, 10, 27, tzinfo=UTC), 1.115),
    ]


def test_empty_body_means_no_data() -> None:
    assert parse_csv("", "fx.eurusd") == []


def test_firewall_page_is_an_error_not_an_empty_result() -> None:
    with pytest.raises(UnexpectedResponse):
        parse_csv(BLOCKED_PAGE, "fx.eurusd")


def test_rows_without_value_are_skipped() -> None:
    text = CSV + "EXR.D.USD.EUR.SP00.A,D,USD,EUR,SP00,A,2026-10-28,\n"
    assert len(parse_csv(text, "fx.eurusd")) == 2


@respx.mock
def test_fetch_requests_the_series_from_a_start_date() -> None:
    spec = load_catalog("ecb").series[0]
    route = respx.get(f"{BASE_URL}/{spec.source_ref}").mock(
        return_value=httpx.Response(200, text=CSV)
    )
    with make_client() as client:
        observations = EcbSource().fetch(client, spec, date(2026, 10, 26))
    assert len(observations) == 2
    assert route.calls.last.request.url.params["startPeriod"] == "2026-10-26"
