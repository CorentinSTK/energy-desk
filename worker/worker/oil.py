"""Crack spreads from official spot prices (pure functions; BUILD_SPEC §4, ADR 0007).

A crack spread is the refining margin implied by prices: what the products sell for minus what the
crude costs, in $/bbl. Every component here is an EIA daily spot price (same price kind), and a
crack exists only on dates where every component has a value: no carry-forward, no interpolation.
Products are quoted in $/gal and converted to $/bbl by the units module.
"""

from collections.abc import Mapping
from datetime import datetime

from worker.units import convert

Prices = Mapping[datetime, float]


def crack_321(gasoline: Prices, diesel: Prices, crude: Prices) -> dict[datetime, float]:
    """3-2-1 crack: (2 barrels of gasoline + 1 of diesel) / 3 - 1 barrel of crude, in $/bbl.

    Three barrels of crude yield roughly two of gasoline and one of distillate in a typical US
    refinery, hence the weights. Gasoline and diesel in $/gal, crude in $/bbl.
    """
    dates = gasoline.keys() & diesel.keys() & crude.keys()
    return {
        ts: (2 * convert(gasoline[ts], "$/gal", "$/bbl") + convert(diesel[ts], "$/gal", "$/bbl"))
        / 3
        - crude[ts]
        for ts in sorted(dates)
    }


def product_crack(product: Prices, crude: Prices) -> dict[datetime, float]:
    """One product against one crude: product ($/gal, converted to $/bbl) - crude ($/bbl)."""
    dates = product.keys() & crude.keys()
    return {ts: convert(product[ts], "$/gal", "$/bbl") - crude[ts] for ts in sorted(dates)}
