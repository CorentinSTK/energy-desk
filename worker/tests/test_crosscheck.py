from datetime import UTC, datetime, timedelta

from worker.crosscheck import compare, hourly_means

HOUR = datetime(2026, 10, 26, 6, tzinfo=UTC)


def test_quarter_hours_are_averaged_per_hour() -> None:
    quarter = timedelta(minutes=15)
    points = [(HOUR + quarter * i, v) for i, v in enumerate([100.0, 110.0, 120.0, 130.0, 50.0])]
    assert hourly_means(points) == {HOUR: 115.0, HOUR + timedelta(hours=1): 50.0}


def test_only_common_hours_beyond_rounding_are_differences() -> None:
    later = HOUR + timedelta(hours=1)
    result = compare(
        {HOUR: 61.70, later: 43.5}, {HOUR: 61.705, later: 44.0, later + later.resolution: 1}
    )
    assert result.compared == 2
    assert result.differences == [(later, 43.5, 44.0)]
