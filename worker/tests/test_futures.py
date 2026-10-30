from datetime import date

import pytest

from worker.futures import (
    add_months,
    calendar_spreads,
    contract_ticker,
    curve_on,
    expiry,
    front_delivery,
)

NOV, DEC, JAN = date(2026, 11, 1), date(2026, 12, 1), date(2027, 1, 1)


def test_contract_tickers_and_month_arithmetic() -> None:
    assert contract_ticker("CL", DEC) == "CLZ26.NYM"
    assert contract_ticker("TTF", JAN) == "TTFF27.NYM"
    assert add_months(date(2026, 11, 28), 2) == JAN
    assert add_months(date(2026, 1, 15), -1) == date(2025, 12, 1)


@pytest.mark.parametrize(
    ("root", "delivery", "last_trade"),
    [
        # CLZ26: 25 Nov 2026 is a Wednesday, three business days before is Friday 20 Nov
        # (Barchart and TradingView list the same date).
        ("CL", DEC, date(2026, 11, 20)),
        # CLX26: 25 Oct 2026 is a Sunday, so count from Friday 23 Oct: Tuesday 20 Oct.
        ("CL", NOV, date(2026, 10, 20)),
        # BZ: last business day of the second month before delivery.
        ("BZ", DEC, date(2026, 10, 30)),
        ("BZ", JAN, date(2026, 11, 30)),
        # HO and RB: last business day of the month before delivery.
        ("HO", NOV, date(2026, 10, 30)),
        ("RB", DEC, date(2026, 11, 30)),
        # TTF: M1 is the month after the trading date (unchanged since M2).
        ("TTF", NOV, date(2026, 10, 31)),
    ],
)
def test_expiry_rules(root: str, delivery: date, last_trade: date) -> None:
    assert expiry(root, delivery) == last_trade


def test_front_month_on_30_october_2026() -> None:
    # Yahoo's CL=F was "Crude Oil Dec 26" that day; HO's November contract traded its last day.
    day = date(2026, 10, 30)
    assert front_delivery("CL", day) == DEC
    assert front_delivery("BZ", day) == DEC
    assert front_delivery("HO", day) == NOV
    assert front_delivery("TTF", day) == NOV
    assert front_delivery("BZ", date(2026, 11, 2)) == JAN


def test_unknown_root_is_an_error() -> None:
    with pytest.raises(ValueError):
        expiry("XX", DEC)


def test_curve_needs_the_rules_front_contract() -> None:
    day = date(2026, 10, 30)
    assert curve_on({DEC: {day: 100.0}, JAN: {day: 98.0}}, "CL", day, 3) == [100.0, 98.0, None]
    # The front (December) has no settlement that day: no curve, not January relabelled as M1.
    assert curve_on({JAN: {day: 98.0}}, "CL", day, 2) is None


def test_an_earlier_contract_still_trading_means_no_curve() -> None:
    # The weekday rule says November expired on 20 Oct; if it still settled on 21 Oct (a holiday
    # shifted the expiry), the day is a gap rather than a curve with the wrong front month.
    day = date(2026, 10, 21)
    settles = {NOV: {day: 101.0}, DEC: {day: 100.0}, JAN: {day: 98.0}}
    assert curve_on(settles, "CL", day, 2) is None


def test_calendar_spreads_per_tenor() -> None:
    d1, d2 = date(2026, 10, 29), date(2026, 10, 30)
    settles = {
        DEC: {d1: 100.0, d2: 101.0},
        JAN: {d1: 99.0, d2: 99.5},
        date(2027, 2, 1): {d2: 98.0},
    }
    spreads = calendar_spreads(settles, "CL", [2, 3])
    assert spreads[2] == [(d1, 1.0), (d2, 1.5)]
    assert spreads[3] == [(d2, 3.0)]  # 29 Oct has no M3 settlement: no value that day


def test_ttf_spread_keeps_its_strict_next_two_months() -> None:
    settles = {
        NOV: {date(2026, 10, 28): 99.3, date(2026, 9, 15): 90.0},
        DEC: {date(2026, 10, 28): 99.1, date(2026, 9, 15): 91.0, date(2026, 11, 3): 98.0},
        JAN: {date(2026, 11, 3): 97.0},
    }
    spread = dict(calendar_spreads(settles, "TTF", [2])[2])
    assert spread[date(2026, 10, 28)] == pytest.approx(0.2)  # Nov - Dec
    assert spread[date(2026, 11, 3)] == pytest.approx(1.0)  # Dec - Jan
    # 15 Sep: M1 is October, which is not listed: no value, never "Nov - Dec" relabelled.
    assert date(2026, 9, 15) not in spread
