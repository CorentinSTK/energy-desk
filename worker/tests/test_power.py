from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from worker.power import daily_means, day_bounds, slots_in_day

BERLIN = ZoneInfo("Europe/Berlin")
LONDON = ZoneInfo("Europe/London")
HOUR = timedelta(hours=1)
HALF_HOUR = timedelta(minutes=30)


def series(start: datetime, step: timedelta, values: list[float]) -> list[tuple[datetime, float]]:
    return [(start + step * i, v) for i, v in enumerate(values)]


def test_local_day_starts_at_local_midnight() -> None:
    assert day_bounds(date(2026, 10, 28), BERLIN) == (
        datetime(2026, 10, 27, 23, tzinfo=UTC),
        datetime(2026, 10, 28, 23, tzinfo=UTC),
    )


@pytest.mark.parametrize(
    ("day", "tz", "step", "expected"),
    [
        (date(2026, 10, 28), BERLIN, HOUR, 24),
        (date(2026, 3, 29), BERLIN, HOUR, 23),  # clocks go forward
        (date(2026, 10, 25), BERLIN, HOUR, 25),  # clocks go back
        (date(2026, 10, 25), LONDON, HALF_HOUR, 50),
        (date(2026, 3, 29), LONDON, HALF_HOUR, 46),
    ],
)
def test_slots_follow_clock_changes(
    day: date, tz: ZoneInfo, step: timedelta, expected: int
) -> None:
    assert slots_in_day(day, tz, step) == expected


def test_complete_day_is_the_time_average() -> None:
    start, _ = day_bounds(date(2026, 10, 28), BERLIN)
    values = [float(h) for h in range(24)]
    assert daily_means(series(start, HOUR, values), BERLIN, HOUR) == {
        date(2026, 10, 28): pytest.approx(11.5)
    }


def test_clock_change_day_needs_all_25_hours() -> None:
    start, _ = day_bounds(date(2026, 10, 25), BERLIN)
    assert daily_means(series(start, HOUR, [10.0] * 25), BERLIN, HOUR) == {date(2026, 10, 25): 10.0}
    assert daily_means(series(start, HOUR, [10.0] * 24), BERLIN, HOUR) == {}


def test_incomplete_day_is_left_out_never_averaged() -> None:
    start, _ = day_bounds(date(2026, 10, 28), BERLIN)
    points = series(start, HOUR, [50.0] * 24)
    del points[5]
    assert daily_means(points, BERLIN, HOUR) == {}


def test_finer_points_are_averaged_within_their_slot() -> None:
    # 15-minute data in 30-minute slots: each slot counts once, whatever its number of points.
    start, _ = day_bounds(date(2026, 10, 28), LONDON)
    quarter = timedelta(minutes=15)
    points = series(start, quarter, [100.0, 200.0] * 48)
    assert daily_means(points, LONDON, HALF_HOUR) == {date(2026, 10, 28): 150.0}


def test_points_are_assigned_to_their_local_day() -> None:
    start, _ = day_bounds(date(2026, 10, 27), BERLIN)
    points = series(start, HOUR, [1.0] * 24 + [2.0] * 24)
    assert daily_means(points, BERLIN, HOUR) == {date(2026, 10, 27): 1.0, date(2026, 10, 28): 2.0}
