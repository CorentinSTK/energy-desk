"""Runs one source end to end: catalogue sync, fetch, validate, store, log in `ingest_runs`.

Status of a run:
- ok       every series fetched, no row rejected
- partial  some series failed or some rows were rejected, but at least one series was fetched
- failed   no series could be fetched, or the database write failed
A failing series never stops the others.
"""

import time
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

import psycopg

from worker import store
from worker.catalog import SeriesSpec, load_catalog
from worker.config import get_settings, require
from worker.sources.base import Source
from worker.validate import Observation, ValidationResult, summarise_rejections, validate

# Without a database (dry run), fetch this much recent history to check the source works.
DRY_RUN_WINDOW = timedelta(days=45)


@dataclass
class RunSummary:
    source: str
    status: str = "ok"
    fetched: dict[str, list[Observation]] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)
    validation: ValidationResult | None = None
    rows_written: int = 0

    @property
    def rows_rejected(self) -> int:
        return len(self.validation.rejected) if self.validation else 0

    def error_text(self) -> str | None:
        parts = [f"{code}: {message}" for code, message in self.errors.items()]
        if self.validation and self.validation.rejected:
            parts.append(summarise_rejections(self.validation.rejected))
        return "\n".join(parts) or None


def decide_status(summary: RunSummary) -> str:
    if not summary.fetched:
        return "failed"
    if summary.errors or summary.rows_rejected:
        return "partial"
    return "ok"


def start_date(
    last: datetime | None,
    lookback: timedelta,
    *,
    backfill: bool,
    since: date | None,
) -> date | None:
    """First date to fetch. None means the full history."""
    if backfill:
        return None
    if since is not None:
        return since
    if last is None:
        return None
    return (last - lookback).date()


def fetch_all(
    source: Source,
    specs: list[SeriesSpec],
    starts: dict[str, date | None],
    summary: RunSummary,
) -> None:
    with source.client() as client:
        for index, spec in enumerate(specs):
            if index:
                time.sleep(source.request_interval)
            try:
                summary.fetched[spec.code] = source.fetch(client, spec, starts[spec.code])
            except Exception as error:  # one failing series must not stop the others
                summary.errors[spec.code] = f"{type(error).__name__}: {error}"


def run(
    source: Source,
    *,
    dry_run: bool,
    backfill: bool = False,
    since: date | None = None,
    only: set[str] | None = None,
    now: datetime | None = None,
) -> RunSummary:
    now = now or datetime.now(UTC)
    catalog = load_catalog(source.name)
    specs = [s for s in catalog.series if only is None or s.code in only]
    by_code = {s.code: s for s in specs}
    summary = RunSummary(source.name)

    if dry_run:
        default_start = None if backfill else since or (now - DRY_RUN_WINDOW).date()
        fetch_all(source, specs, {s.code: default_start for s in specs}, summary)
        summary.validation = validate(_flatten(summary), by_code, now)
        summary.status = decide_status(summary)
        return summary

    url = require(get_settings().database_url, "DATABASE_URL")
    with psycopg.connect(url) as conn:
        series_ids = store.sync_series(conn, catalog)
        run_id = store.start_run(conn, source.name)
        conn.commit()  # the 'running' row stays visible if the process dies

        last = store.last_observations(conn, [series_ids[s.code] for s in specs])
        starts = {
            s.code: start_date(
                last.get(series_ids[s.code]), source.lookback, backfill=backfill, since=since
            )
            for s in specs
        }
        fetch_all(source, specs, starts, summary)
        summary.validation = validate(_flatten(summary), by_code, now)
        summary.status = decide_status(summary)
        try:
            summary.rows_written = store.upsert_observations(
                conn, series_ids, summary.validation.valid
            )
            conn.commit()
        except psycopg.Error as error:
            conn.rollback()
            summary.status = "failed"
            summary.errors["database"] = f"{type(error).__name__}: {error}"
        store.finish_run(
            conn,
            run_id,
            summary.status,
            summary.rows_written,
            summary.rows_rejected,
            summary.error_text(),
        )
        conn.commit()
    return summary


def _flatten(summary: RunSummary) -> list[Observation]:
    return [obs for observations in summary.fetched.values() for obs in observations]
