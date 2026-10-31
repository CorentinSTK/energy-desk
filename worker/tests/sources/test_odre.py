from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
import pytest
import respx

from worker.catalog import load_catalog
from worker.http_client import make_client
from worker.sources.odre import (
    BASE_URL,
    COLUMNS,
    CONSOLIDATED,
    REAL_TIME,
    OdreSource,
    merge,
    parse_rows,
    year_windows,
)

SPECS = {s.code: s for s in load_catalog("odre").series}
# 28 October 2026 starts at 23:00 UTC the day before in Europe/Paris.
DAY_START = datetime(2026, 10, 27, 23, tzinfo=UTC)


def rows(start: datetime, step: timedelta, count: int, **values: Any) -> list[dict[str, Any]]:
    return [{"date_heure": (start + step * i).isoformat(), **values} for i in range(count)]


def test_strings_are_numbers_and_nulls_are_missing() -> None:
    points = parse_rows(
        [{"date_heure": "2026-10-29T07:00:00+00:00", "hydraulique": "2431", "nucleaire": None}]
    )
    assert points["hydraulique"] == [(datetime(2026, 10, 29, 7, tzinfo=UTC), 2431.0)]
    assert points["nucleaire"] == []


def test_not_available_is_missing_for_that_column_only() -> None:
    # 2015 consolidated data has one "ND" in the Germany-Belgium exchange.
    points = parse_rows(
        [
            {
                "date_heure": "2015-03-01T07:00:00+00:00",
                "ech_comm_allemagne_belgique": "ND",
                "consommation": 70000,
            }
        ]
    )
    assert points["ech_comm_allemagne_belgique"] == []
    assert points["consommation"] == [(datetime(2015, 3, 1, 7, tzinfo=UTC), 70000.0)]


def test_unexpected_text_fails_loudly() -> None:
    with pytest.raises(ValueError, match="nucleaire at 2015-03-01"):
        parse_rows([{"date_heure": "2015-03-01T07:00:00+00:00", "nucleaire": "n/a"}])


def test_consolidated_value_wins_for_the_same_half_hour() -> None:
    ts = datetime(2026, 8, 31, 21, 30, tzinfo=UTC)
    consolidated = [(ts, 100.0)]
    real_time = [(ts, 90.0), (ts + timedelta(minutes=15), 95.0), (ts + timedelta(minutes=30), 80.0)]
    assert merge(consolidated, real_time) == [(ts, 100.0), (ts + timedelta(minutes=30), 80.0)]


def test_history_is_requested_one_year_at_a_time() -> None:
    start = datetime(2019, 12, 31, 23, tzinfo=UTC)
    end = datetime(2021, 6, 1, tzinfo=UTC)
    assert year_windows(start, end) == [
        (start, datetime(2020, 1, 1, tzinfo=UTC)),
        (datetime(2020, 1, 1, tzinfo=UTC), datetime(2021, 1, 1, tzinfo=UTC)),
        (datetime(2021, 1, 1, tzinfo=UTC), end),
    ]


@respx.mock
def test_both_datasets_are_fetched_once_and_averaged_per_paris_day() -> None:
    half_hour = timedelta(minutes=30)
    # Consolidated: the first 12 hours of the day at 30-minute steps (the :15/:45 rows are empty).
    consolidated = rows(DAY_START, half_hour, 24, consommation=50000)
    consolidated += rows(DAY_START + timedelta(minutes=15), half_hour, 24, consommation=None)
    # Real time: the whole day at 15-minute steps; only the second half is used.
    real_time = rows(DAY_START, timedelta(minutes=15), 96, consommation=60000)
    routes = {
        CONSOLIDATED: respx.get(f"{BASE_URL}/{CONSOLIDATED}/exports/json").mock(
            return_value=httpx.Response(200, json=consolidated)
        ),
        REAL_TIME: respx.get(f"{BASE_URL}/{REAL_TIME}/exports/json").mock(
            return_value=httpx.Response(200, json=real_time)
        ),
    }
    source = OdreSource()
    with make_client() as client:
        load = source.fetch(client, SPECS["odre.fr.load"], date(2026, 10, 28))
        nuclear = source.fetch(client, SPECS["odre.fr.gen.nuclear"], date(2026, 10, 28))
    assert routes[CONSOLIDATED].call_count == routes[REAL_TIME].call_count == 1
    assert [(o.ts, o.value) for o in load] == [(datetime(2026, 10, 28, tzinfo=UTC), 55000.0)]
    assert nuclear == []  # no values at all: nothing is invented
    select = routes[REAL_TIME].calls[0].request.url.params["select"]
    assert select.split(",") == ["date_heure", *COLUMNS]


def test_every_catalogue_column_is_requested() -> None:
    assert {spec.source_ref for spec in SPECS.values()} <= set(COLUMNS)


def test_unknown_column_fails_loudly() -> None:
    spec = SPECS["odre.fr.load"].model_copy(update={"source_ref": "taux_co2"})
    with make_client() as client, pytest.raises(ValueError, match="unknown éCO2mix column"):
        OdreSource().fetch(client, spec, None)
