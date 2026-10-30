"""Generic futures months (M1, M2, …) rebuilt from individual contracts (pure functions; ADR 0007).

"M1" on a trading date is the first contract that has not yet expired on that date. Each exchange
fixes when a contract stops trading, so the front month rolls on a different day per product:

- CL (NYMEX WTI): 3 business days before the 25th calendar day of the month before delivery; if the
  25th is not a business day, 3 business days before the business day preceding it.
- BZ (NYMEX Brent Last Day Financial): last business day of the second month before delivery,
  aligned with ICE Brent.
- HO, RB (NYMEX ULSD, RBOB): last business day of the month before delivery.
- TTF (NYMEX Dutch TTF): taken as the month after the trading date, as since M2 (ADR 0003).

Rules adapted from the author's oil-tracker project and checked against published last trade dates
(e.g. CLZ26: 20 November 2026). Business days are weekdays only: exchange holidays are ignored, so
an expiry next to a holiday can be off by one day. The guard in `curve_on` turns such a day into a
gap instead of a shifted curve: a date is used only if the rule's front contract has a settlement
that day and no earlier contract does.
"""

from collections.abc import Mapping
from datetime import date, timedelta

MONTH_CODES = "FGHJKMNQUVXZ"  # futures month letters, January to December

# delivery month → trading date → settlement
Settles = Mapping[date, Mapping[date, float]]


def add_months(day: date, months: int) -> date:
    """First day of the month `months` after the month of `day`."""
    index = day.year * 12 + day.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def contract_ticker(root: str, delivery_month: date) -> str:
    """CL + December 2026 → 'CLZ26.NYM' (Yahoo's ticker for a NYMEX contract)."""
    return f"{root}{MONTH_CODES[delivery_month.month - 1]}{delivery_month.year % 100:02d}.NYM"


def is_business_day(day: date) -> bool:
    return day.weekday() < 5


def business_days_before(day: date, count: int) -> date:
    while count > 0:
        day -= timedelta(days=1)
        if is_business_day(day):
            count -= 1
    return day


def last_business_day(month_start: date) -> date:
    day = add_months(month_start, 1) - timedelta(days=1)
    while not is_business_day(day):
        day -= timedelta(days=1)
    return day


def expiry(root: str, delivery: date) -> date:
    """Last trading day of the contract for `delivery` (first day of the delivery month)."""
    if root == "CL":
        the_25th = add_months(delivery, -1).replace(day=25)
        if not is_business_day(the_25th):
            the_25th = business_days_before(the_25th, 1)
        return business_days_before(the_25th, 3)
    if root == "BZ":
        return last_business_day(add_months(delivery, -2))
    if root in ("HO", "RB"):
        return last_business_day(add_months(delivery, -1))
    if root == "TTF":
        return add_months(delivery, 0) - timedelta(days=1)
    raise ValueError(f"No expiry rule for futures root {root!r}")


def front_delivery(root: str, day: date) -> date:
    """Delivery month of M1 on `day`: the first contract whose last trading day is not past."""
    delivery = add_months(day, 0)
    while expiry(root, delivery) < day:
        delivery = add_months(delivery, 1)
    return delivery


def curve_on(settles: Settles, root: str, day: date, tenors: int) -> list[float | None] | None:
    """Settlements of M1..M{tenors} on `day`, or None if the front month cannot be trusted."""
    front = front_delivery(root, day)
    if day not in settles.get(front, {}):
        return None
    if any(d < front and day in by_date for d, by_date in settles.items()):
        return None  # an earlier contract still traded: the rule is off (holiday) on this day
    return [settles.get(add_months(front, n), {}).get(day) for n in range(tenors)]


def calendar_spreads(
    settles: Settles, root: str, tenors: list[int]
) -> dict[int, list[tuple[date, float]]]:
    """M1 - Mn per trading date for each n in `tenors` (positive = backwardation).

    A date contributes to a tenor only if both M1 and Mn settled that day.
    """
    longest = max(tenors)
    dates = sorted({d for by_date in settles.values() for d in by_date})
    spreads: dict[int, list[tuple[date, float]]] = {n: [] for n in tenors}
    for day in dates:
        curve = curve_on(settles, root, day, longest)
        if curve is None or curve[0] is None:
            continue
        for n in tenors:
            other = curve[n - 1]
            if other is not None:
                spreads[n].append((day, curve[0] - other))
    return spreads
