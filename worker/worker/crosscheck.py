"""Cross-checks between independent sources. Prints differences; stores nothing.

    uv run python -m worker.crosscheck power      # SMARD vs Energy-Charts, day-ahead prices, 7 days

Energy-Charts (Fraunhofer ISE) publishes day-ahead prices per 15 minutes; their hourly mean must
match SMARD's hourly price. A difference means one source revised or misreported a value, or a
mapping in the catalogue is wrong (e.g. a SMARD filter that is not the zone we think).
"""

import argparse
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from worker.catalog import load_catalog
from worker.http_client import get_json, make_client
from worker.power import Point
from worker.sources.smard import SmardSource

ENERGY_CHARTS_URL = "https://api.energy-charts.info/price"
# SMARD series code → Energy-Charts bidding zone.
PRICE_PAIRS = {"smard.de_lu.price_da": "DE-LU", "smard.fr.price_da": "FR"}
TOLERANCE = 0.01  # €/MWh: prices are published with two decimals


@dataclass(frozen=True)
class Comparison:
    compared: int
    differences: list[tuple[datetime, float, float]]


def hourly_means(points: list[Point]) -> dict[datetime, float]:
    by_hour: dict[datetime, list[float]] = defaultdict(list)
    for ts, value in points:
        by_hour[ts.replace(minute=0, second=0, microsecond=0)].append(value)
    return {hour: sum(values) / len(values) for hour, values in by_hour.items()}


def compare(reference: dict[datetime, float], other: dict[datetime, float]) -> Comparison:
    common = sorted(reference.keys() & other.keys())
    differences = [
        (ts, reference[ts], other[ts])
        for ts in common
        if abs(reference[ts] - other[ts]) > TOLERANCE
    ]
    return Comparison(len(common), differences)


def energy_charts_prices(zone: str, start: date, end: date) -> list[Point]:
    with make_client() as client:
        body = get_json(
            client,
            ENERGY_CHARTS_URL,
            {"bzn": zone, "start": start.isoformat(), "end": end.isoformat()},
        )
    return [
        (datetime.fromtimestamp(ts, UTC), float(price))
        for ts, price in zip(body["unix_seconds"], body["price"], strict=True)
        if price is not None
    ]


def check_power(days: int = 7) -> bool:
    end = date.today()
    start = end - timedelta(days=days)
    specs = {s.code: s for s in load_catalog("smard").series}
    source = SmardSource()
    ok = True
    with make_client() as client:
        for code, zone in PRICE_PAIRS.items():
            smard = {o.ts: o.value for o in source.fetch(client, specs[code], start)}
            result = compare(smard, hourly_means(energy_charts_prices(zone, start, end)))
            print(
                f"{code} vs Energy-Charts {zone}: {result.compared} hours compared, "
                f"{len(result.differences)} difference(s)"
            )
            for ts, ours, theirs in result.differences[:10]:
                print(f"  {ts.isoformat()}  SMARD {ours:.2f}  Energy-Charts {theirs:.2f}")
            ok = ok and result.compared > 0 and not result.differences
    return ok


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="worker.crosscheck", description=__doc__.splitlines()[0])
    parser.add_argument("check", choices=["power"])
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args(argv)
    return 0 if check_power(args.days) else 1


if __name__ == "__main__":
    raise SystemExit(main())
