from datetime import UTC, datetime

from worker.catalog import load_catalog
from worker.sources.fred import parse_observations

SPEC = load_catalog("fred").series[0]


def test_dot_means_missing_and_is_skipped() -> None:
    rows = [
        {"date": "2026-08-01", "value": "20.922"},
        {"date": "2026-09-01", "value": "."},
    ]
    observations = parse_observations(rows, SPEC)
    assert [(o.ts, o.value) for o in observations] == [(datetime(2026, 8, 1, tzinfo=UTC), 20.922)]
