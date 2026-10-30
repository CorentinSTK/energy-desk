from datetime import UTC, datetime

import pytest

from worker.oil import crack_321, product_crack

D1 = datetime(2026, 10, 26, tzinfo=UTC)
D2 = datetime(2026, 10, 27, tzinfo=UTC)


def test_321_crack_matches_a_hand_calculation() -> None:
    # EIA spots of 27 Oct 2026: USGC gasoline 3.101 and ULSD 4.767 $/gal, WTI 103.37 $/bbl.
    # (2 * 3.101 + 4.767) * 42 / 3 - 103.37 = 50.196
    crack = crack_321({D2: 3.101}, {D2: 4.767}, {D2: 103.37})
    assert crack == {D2: pytest.approx(50.196)}


def test_product_crack_converts_gallons_to_barrels() -> None:
    assert product_crack({D2: 4.687}, {D2: 123.1}) == {D2: pytest.approx(73.754)}


def test_a_date_missing_any_component_has_no_value() -> None:
    crack = crack_321({D1: 3.0, D2: 3.1}, {D1: 4.0, D2: 4.7}, {D2: 100.0})
    assert list(crack) == [D2]
    assert product_crack({D1: 4.0}, {D2: 100.0}) == {}
