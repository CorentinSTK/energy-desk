from datetime import UTC, datetime

import pytest

from worker.units import (
    MMBTU_PER_MWH,
    UnitError,
    convert,
    convert_currency,
    factor,
    invert_rates,
)


def test_mmbtu_per_mwh_matches_reference_value() -> None:
    assert pytest.approx(3.412141633, rel=1e-9) == MMBTU_PER_MWH


@pytest.mark.parametrize(
    ("value", "from_unit", "to_unit", "expected"),
    [
        (3.0, "$/MMBtu", "$/MWh", 10.236424899),
        (34.12141633, "€/MWh", "€/MMBtu", 10.0),
        (100.0, "p/therm", "£/MWh", 34.12141633),
        (1.0, "$/gal", "$/bbl", 42.0),
        (250.0, "¢/gal", "$/bbl", 105.0),
        (1000.0, "mb", "Mm³", 158.987294928),
        (1500.0, "GWh", "TWh", 1.5),
    ],
)
def test_conversions(value: float, from_unit: str, to_unit: str, expected: float) -> None:
    assert convert(value, from_unit, to_unit) == pytest.approx(expected, rel=1e-9)


def test_reverse_direction_and_round_trip() -> None:
    assert factor("$/MWh", "$/MMBtu") == pytest.approx(1 / MMBTU_PER_MWH)
    assert convert(convert(12.5, "$/bbl", "$/m³"), "$/m³", "$/bbl") == pytest.approx(12.5)


def test_unknown_conversion_is_an_error() -> None:
    with pytest.raises(UnitError):
        convert(1.0, "$/bbl", "€/MWh")  # needs a currency rate, not a factor


def test_currency_conversion_uses_same_date_only() -> None:
    d1, d2, d3 = (datetime(2026, 10, d, tzinfo=UTC) for d in (26, 27, 28))
    prices_usd = {d1: 10.0, d2: 20.0, d3: 30.0}
    eur_per_usd = invert_rates({d1: 1.25, d3: 1.0})  # no rate on d2
    assert convert_currency(prices_usd, eur_per_usd) == {d1: 8.0, d3: 30.0}
