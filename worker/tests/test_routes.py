"""The generated route table (scripts/gen_routes.py → apps/web/src/lib/freight/routes.json).

Checked without searoute, so CI does not need the routes dependency group: consistency of the
committed file, and distances against published orders of magnitude.
"""

import json
from pathlib import Path
from typing import Any

import pytest

ROUTES_JSON = Path(__file__).resolve().parents[2] / "apps/web/src/lib/freight/routes.json"
DATA: dict[str, Any] = json.loads(ROUTES_JSON.read_text())
ROUTES = {r["id"]: r for r in DATA["routes"]}
PASSAGE = {"Suez Canal": "suez", "Panama Canal": "panama", "Cape of Good Hope": "south_africa"}


def nm(route_id: str, via: str) -> int:
    return int(next(v["nm"] for v in ROUTES[route_id]["variants"] if v["via"] == via))


def test_days_follow_the_stated_speed() -> None:
    for route in DATA["routes"]:
        knots = DATA["knots"][route["cargo"]]
        for v in route["variants"]:
            assert v["days"] == round(v["nm"] / (knots * 24), 1)


def test_each_variant_crosses_what_its_label_says() -> None:
    for route in DATA["routes"]:
        for v in route["variants"]:
            if v["via"] in PASSAGE:
                assert PASSAGE[v["via"]] in v["passages"], (route["id"], v["via"])
            if v["via"] == "Cape of Good Hope":
                assert "suez" not in v["passages"] and "panama" not in v["passages"]


def test_the_cape_is_always_the_long_way() -> None:
    assert nm("crude_gulf_europe", "Cape of Good Hope") > nm("crude_gulf_europe", "Suez Canal")
    assert nm("lng_qatar_europe", "Cape of Good Hope") > nm("lng_qatar_europe", "Suez Canal")
    assert nm("lng_us_japan", "Cape of Good Hope") > nm("lng_us_japan", "Panama Canal")


@pytest.mark.parametrize(
    ("route_id", "via", "low", "high"),
    [
        # Published voyage distances, rounded (orders of magnitude, not exact port pairs).
        ("crude_gulf_europe", "Suez Canal", 6000, 7000),
        ("crude_gulf_europe", "Cape of Good Hope", 10500, 12000),
        ("crude_gulf_china", "Direct", 5500, 6300),
        ("crude_usgc_europe", "Direct", 4700, 5300),
        ("lng_us_japan", "Panama Canal", 8800, 9800),
    ],
)
def test_distances_match_published_orders_of_magnitude(
    route_id: str, via: str, low: int, high: int
) -> None:
    assert low <= nm(route_id, via) <= high


def test_stand_in_ports_say_what_they_stand_for() -> None:
    origins = {r["origin"]["name"]: r["origin"]["standsFor"] for r in DATA["routes"]}
    assert origins["Jubail"] and origins["Doha"] and origins["Port Arthur"]
