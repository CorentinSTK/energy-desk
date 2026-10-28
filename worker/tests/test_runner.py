from datetime import UTC, date, datetime, timedelta

import httpx

from worker import runner
from worker.catalog import SeriesSpec
from worker.sources.base import Source
from worker.validate import Observation

NOW = datetime(2026, 10, 28, 12, tzinfo=UTC)


class FakeSource(Source):
    """Uses the ECB catalogue; fails on demand for one series."""

    name = "ecb"
    request_interval = 0

    def __init__(self, failing: set[str] | None = None, bad_value: bool = False) -> None:
        self.failing = failing or set()
        self.bad_value = bad_value
        self.starts: dict[str, date | None] = {}

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        self.starts[spec.code] = since
        if spec.code in self.failing:
            raise RuntimeError("provider down")
        value = 99.0 if self.bad_value else 1.1
        return [Observation(spec.code, NOW - timedelta(days=1), value)]


def test_dry_run_ok() -> None:
    summary = runner.run(FakeSource(), dry_run=True, now=NOW)
    assert summary.status == "ok"
    assert summary.rows_written == 0


def test_dry_run_fetches_a_recent_window() -> None:
    source = FakeSource()
    runner.run(source, dry_run=True, now=NOW)
    assert set(source.starts.values()) == {(NOW - runner.DRY_RUN_WINDOW).date()}


def test_one_failing_series_makes_the_run_partial() -> None:
    summary = runner.run(FakeSource(failing={"fx.eurgbp"}), dry_run=True, now=NOW)
    assert summary.status == "partial"
    assert "fx.eurgbp: RuntimeError: provider down" in (summary.error_text() or "")


def test_all_series_failing_makes_the_run_failed() -> None:
    summary = runner.run(FakeSource(failing={"fx.eurusd", "fx.eurgbp"}), dry_run=True, now=NOW)
    assert summary.status == "failed"


def test_rejected_rows_make_the_run_partial() -> None:
    summary = runner.run(FakeSource(bad_value=True), dry_run=True, now=NOW)
    assert summary.status == "partial"
    assert summary.rows_rejected == 2


def test_start_date_rules() -> None:
    last = datetime(2026, 10, 20, tzinfo=UTC)
    week = timedelta(days=7)
    assert runner.start_date(last, week, backfill=False, since=None) == date(2026, 10, 13)
    assert runner.start_date(None, week, backfill=False, since=None) is None  # first run: history
    assert runner.start_date(last, week, backfill=True, since=None) is None
    assert runner.start_date(last, week, backfill=False, since=date(2020, 1, 1)) == date(2020, 1, 1)
