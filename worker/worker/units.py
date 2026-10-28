"""Unit and currency conversions: the only place values change unit (CLAUDE.md, BUILD_SPEC §4).

Values are stored in the source's unit. Converted series are derived here, with exact factors.
Currency conversion uses the exchange rate of the same date only: if that rate is missing, the
converted value is missing too. Rates are never carried forward or interpolated.
"""

from collections.abc import Mapping
from datetime import datetime

# Energy. 1 Btu (International Table) = 1055.05585262 J; 1 MWh = 3.6e9 J.
MMBTU_PER_MWH = 3.6e9 / 1055.05585262e6  # ≈ 3.412141633
THERMS_PER_MWH = MMBTU_PER_MWH * 10  # 1 therm = 0.1 MMBtu

# Volume. 1 US oil barrel = 42 US gallons = 0.158987294928 m³ (exact).
M3_PER_BARREL = 0.158987294928
GALLONS_PER_BARREL = 42

# Linear factors: value_in_to = value_in_from * factor. Same dimension and currency only.
_FACTORS: dict[tuple[str, str], float] = {
    ("$/MMBtu", "$/MWh"): MMBTU_PER_MWH,
    ("€/MWh", "€/MMBtu"): 1 / MMBTU_PER_MWH,
    ("p/therm", "£/MWh"): THERMS_PER_MWH / 100,  # pence → pounds
    ("$/bbl", "$/m³"): 1 / M3_PER_BARREL,
    ("$/gal", "$/bbl"): GALLONS_PER_BARREL,
    ("¢/gal", "$/bbl"): GALLONS_PER_BARREL / 100,
    ("mb", "Mm³"): M3_PER_BARREL,  # thousand barrels → thousand m³
    ("GWh", "TWh"): 1e-3,
    ("kWh/d", "GWh/d"): 1e-6,
}


class UnitError(ValueError):
    pass


def factor(from_unit: str, to_unit: str) -> float:
    """Multiplier from one unit to another of the same dimension and currency."""
    if from_unit == to_unit:
        return 1.0
    if (from_unit, to_unit) in _FACTORS:
        return _FACTORS[(from_unit, to_unit)]
    if (to_unit, from_unit) in _FACTORS:
        return 1 / _FACTORS[(to_unit, from_unit)]
    raise UnitError(f"No conversion defined from {from_unit!r} to {to_unit!r}")


def convert(value: float, from_unit: str, to_unit: str) -> float:
    return value * factor(from_unit, to_unit)


def convert_currency(
    values: Mapping[datetime, float],
    rates: Mapping[datetime, float],
) -> dict[datetime, float]:
    """Multiply each value by the rate of the same timestamp; dates without a rate are left out.

    `rates` must be expressed as target currency per source currency (e.g. EUR per USD to turn $
    into €). ECB rates are quoted as USD per EUR, so invert them first with `invert_rates`.
    """
    return {ts: v * rates[ts] for ts, v in values.items() if ts in rates}


def invert_rates(rates: Mapping[datetime, float]) -> dict[datetime, float]:
    return {ts: 1 / r for ts, r in rates.items()}
