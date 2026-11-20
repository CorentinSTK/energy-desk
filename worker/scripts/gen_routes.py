"""Write apps/web/src/lib/freight/routes.json: sea distances and days at sea for benchmark energy
routes, with and without a canal (ADR 0013). Generated, never edited by hand.

    uv run --group routes python -m scripts.gen_routes

Method:
- Shortest path on the Eurostat maritime network, through the `searoute` package (Apache-2.0).
  Its authors state it is not for navigation: the distances are orders of magnitude, not routing.
- Ports are Natural Earth ports (public domain). Where the actual terminal is not in Natural Earth,
  the nearest listed port stands in, and the page names the port used.
- Days at sea = distance / (laden speed x 24). No port time, canal waiting or weather margin.
- Each variant's passages are checked: "via Suez" really crosses Suez, "via the Cape" does not.
"""

import json
from pathlib import Path
from typing import Any

import searoute as sr

OUTPUT = (
    Path(__file__).resolve().parents[2] / "apps" / "web" / "src" / "lib" / "freight" / "routes.json"
)

# Laden service speeds, stated on the page: round figures, not a fleet survey.
KNOTS = {"crude": 13, "lng": 17}
# searoute excludes the Northwest Passage by default; every variant keeps that restriction.
ALWAYS_CLOSED = ["northwest"]

# [lon, lat] from Natural Earth ne_10m_ports; `stands_for` names the terminal it approximates.
PORTS: dict[str, dict[str, Any]] = {
    "jubail": {"name": "Jubail", "stands_for": "Ras Tanura (Saudi crude)", "at": [49.671, 27.029]},
    "doha": {"name": "Doha", "stands_for": "Ras Laffan (Qatari LNG)", "at": [51.556, 25.298]},
    "port_arthur": {
        "name": "Port Arthur",
        "stands_for": "Sabine Pass (US LNG)",
        "at": [-93.957, 29.843],
    },
    "houston": {"name": "Houston", "stands_for": None, "at": [-95.202, 29.739]},
    "ningbo": {"name": "Ningbo", "stands_for": None, "at": [121.553, 29.867]},
    "rotterdam": {"name": "Rotterdam", "stands_for": None, "at": [4.293, 51.927]},
    "tokyo": {"name": "Tokyo", "stands_for": None, "at": [139.788, 35.625]},
}

# Variant: label, extra closed passages, passages it must cross, passages it must avoid.
VIA_SUEZ = ("Suez Canal", [], ["suez"], [])
VIA_CAPE_FROM_GULF = ("Cape of Good Hope", ["suez", "babalmandab"], ["south_africa"], ["suez"])
VIA_PANAMA = ("Panama Canal", [], ["panama"], [])
# Without Panama, the shortest US Gulf → Japan route goes through Suez; the Cape needs both closed.
VIA_SUEZ_FROM_US = ("Suez Canal", ["panama"], ["suez"], ["panama"])
VIA_CAPE_FROM_US = (
    "Cape of Good Hope",
    ["panama", "suez", "babalmandab"],
    ["south_africa"],
    ["panama", "suez"],
)
DIRECT = ("Direct", [], [], [])

ROUTES = [
    ("crude_gulf_china", "Gulf crude to China", "crude", "jubail", "ningbo", [DIRECT]),
    (
        "crude_gulf_europe",
        "Gulf crude to Europe",
        "crude",
        "jubail",
        "rotterdam",
        [VIA_SUEZ, VIA_CAPE_FROM_GULF],
    ),
    ("crude_usgc_europe", "US Gulf crude to Europe", "crude", "houston", "rotterdam", [DIRECT]),
    (
        "lng_qatar_europe",
        "Qatari LNG to Europe",
        "lng",
        "doha",
        "rotterdam",
        [VIA_SUEZ, VIA_CAPE_FROM_GULF],
    ),
    ("lng_us_europe", "US LNG to Europe", "lng", "port_arthur", "rotterdam", [DIRECT]),
    (
        "lng_us_japan",
        "US LNG to Japan",
        "lng",
        "port_arthur",
        "tokyo",
        [VIA_PANAMA, VIA_SUEZ_FROM_US, VIA_CAPE_FROM_US],
    ),
]


def variant(
    origin: str, destination: str, cargo: str, spec: tuple[str, list[str], list[str], list[str]]
) -> dict[str, Any]:
    via, closed, must_cross, must_avoid = spec
    route = sr.searoute(
        PORTS[origin]["at"],
        PORTS[destination]["at"],
        units="naut",
        restrictions=ALWAYS_CLOSED + closed,
        return_passages=True,
    )
    passages = sorted(set(route.properties.get("traversed_passages") or []))
    for passage in must_cross:
        if passage not in passages:
            raise ValueError(f"{origin}→{destination} via {via}: does not cross {passage}")
    for passage in must_avoid:
        if passage in passages:
            raise ValueError(f"{origin}→{destination} via {via}: crosses {passage}")
    nm = round(route.properties["length"])
    return {
        "via": via,
        "nm": nm,
        "days": round(nm / (KNOTS[cargo] * 24), 1),
        "passages": passages,
    }


def port(key: str) -> dict[str, Any]:
    p = PORTS[key]
    return {"name": p["name"], "standsFor": p["stands_for"], "lon": p["at"][0], "lat": p["at"][1]}


def build() -> dict[str, Any]:
    return {
        "generatedBy": "worker/scripts/gen_routes.py (searoute 1.6.0, Eurostat maritime network)",
        "knots": KNOTS,
        "routes": [
            {
                "id": route_id,
                "label": label,
                "cargo": cargo,
                "origin": port(origin),
                "destination": port(destination),
                "variants": [variant(origin, destination, cargo, v) for v in variants],
            }
            for route_id, label, cargo, origin, destination, variants in ROUTES
        ],
    }


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(build(), indent=2) + "\n")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
