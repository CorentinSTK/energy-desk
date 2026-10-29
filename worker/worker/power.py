"""Daily averages of intraday power data (BUILD_SPEC §5, ADR 0006). Pure functions.

Load and generation are stored per local delivery day as the **average power (MW)** over that day:
unlike daily energy (MWh), it is not distorted by 23- and 25-hour clock-change days, so days compare
directly. Prices use the same calculation: the "base" price is the time average over the delivery
day.

Rules:
- The day is the local delivery day (Europe/Berlin, Europe/Paris, Europe/London), stored at 00:00
  UTC like every other daily series.
- Points are grouped into fixed slots (e.g. 30 minutes); a slot's value is the mean of its points,
  so a source with finer steps (15-minute data in 30-minute slots) is averaged, not double counted.
- A day is kept only if **every** slot of that day has a value. Incomplete days are not stored: they
  show as gaps, never as averages of what happens to be there.
"""

from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

Point = tuple[datetime, float]  # timezone-aware timestamp of the period start, value


def day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    """Start and end (exclusive) of a local day, in UTC."""
    start = datetime.combine(day, time(0), tzinfo=tz)
    end = datetime.combine(day + timedelta(days=1), time(0), tzinfo=tz)
    return start.astimezone(UTC), end.astimezone(UTC)


def slots_in_day(day: date, tz: ZoneInfo, step: timedelta) -> int:
    """Number of `step` slots in a local day: 24 hours, or 23 / 25 on clock-change days."""
    start, end = day_bounds(day, tz)
    return int((end - start) / step)


def daily_means(points: Iterable[Point], tz: ZoneInfo, step: timedelta) -> dict[date, float]:
    """Time-average per complete local day; days with any missing slot are left out."""
    slot_seconds = step.total_seconds()
    slots: dict[datetime, list[float]] = defaultdict(list)
    for ts, value in points:
        epoch = ts.timestamp()
        slot = datetime.fromtimestamp(epoch - epoch % slot_seconds, UTC)
        slots[slot].append(value)

    by_day: dict[date, list[float]] = defaultdict(list)
    for slot, values in slots.items():
        by_day[slot.astimezone(tz).date()].append(sum(values) / len(values))

    return {
        day: sum(values) / len(values)
        for day, values in sorted(by_day.items())
        if len(values) == slots_in_day(day, tz, step)
    }


def day_ts(day: date) -> datetime:
    """Timestamp under which a daily value is stored."""
    return datetime(day.year, day.month, day.day, tzinfo=UTC)
