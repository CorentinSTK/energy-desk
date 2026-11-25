from datetime import UTC, datetime

import pytest

from worker.oil import crack_321, price_ratio_pct, product_crack

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


def test_price_ratio_is_the_product_in_barrels_over_crude() -> None:
    # Propane 1.019 $/gal = 42.798 $/bbl; against WTI at 60 $/bbl that is 71.33 %.
    assert price_ratio_pct({D2: 1.019}, {D2: 60.0}) == {D2: pytest.approx(71.33, abs=0.01)}


def test_price_ratio_skips_non_positive_crude_and_missing_dates() -> None:
    ratio = price_ratio_pct({D1: 0.5, D2: 1.0}, {D1: -37.6, D2: 50.0})
    assert list(ratio) == [D2]
