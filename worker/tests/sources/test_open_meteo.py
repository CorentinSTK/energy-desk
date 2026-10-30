from datetime import UTC, date, datetime
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.open_meteo import URL, OpenMeteoSource, parse_daily

SPECS = load_catalog("open_meteo").series


def location(values: list[float | None], unit: str = "°C") -> dict[str, Any]:
    # Shape of a live response (2026-10-30), trimmed.
    return {
        "daily_units": {"time": "iso8601", "temperature_2m_mean": unit},
        "daily": {
            "time": ["2026-10-28", "2026-10-29"][: len(values)],
            "temperature_2m_mean": values,
        },
    }


def test_parse_daily_skips_nulls_and_checks_the_unit() -> None:
    observations = parse_daily(location([10.3, None]), "x")
    assert [(o.ts, o.value) for o in observations] == [(datetime(2026, 10, 28, tzinfo=UTC), 10.3)]
    with pytest.raises(ValueError, match="unit"):
        parse_daily(location([10.3], unit="°F"), "x")


@respx.mock
def test_one_request_serves_every_city_and_stops_yesterday() -> None:
    route = respx.get(URL).mock(
        return_value=httpx.Response(
            200, json=[location([9.0 + i, 9.5 + i]) for i in range(len(SPECS))]
        )
    )
    source = OpenMeteoSource(today=lambda: date(2026, 10, 30))
    with make_client() as client:
        results = [source.fetch(client, spec, date(2026, 10, 28)) for spec in SPECS]
    assert route.call_count == 1
    assert [r[0].value for r in results] == [9.0 + i for i in range(len(SPECS))]
    params = route.calls[0].request.url.params
    assert params["end_date"] == "2026-10-29"
    assert params["latitude"].count(",") == len(SPECS) - 1


@respx.mock
def test_a_missing_location_fails_loudly() -> None:
    respx.get(URL).mock(return_value=httpx.Response(200, json=[location([9.0])]))
    with make_client() as client, pytest.raises(ValueError, match="locations"):
        OpenMeteoSource().fetch(client, SPECS[0], None)
