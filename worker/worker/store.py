"""Database writes for ingestion: catalogue sync, observation upserts, the `ingest_runs` log."""

from collections.abc import Iterable
from datetime import datetime

import psycopg

from worker.catalog import SourceCatalog
from worker.validate import Observation

RUN_STATUSES = ("ok", "partial", "failed", "skipped")
MAX_ERROR_LENGTH = 4000


def sync_series(conn: psycopg.Connection, catalog: SourceCatalog) -> dict[str, int]:
    """Insert or update every series of a source's catalogue. Returns code → series id."""
    ids: dict[str, int] = {}
    for spec in catalog.series:
        licence = catalog.licence_for(spec)
        row = conn.execute(
            """
            insert into market.series (code, name, commodity, region, unit, frequency, source,
                source_ref, description, is_unofficial, price_kind, license, license_url,
                attribution, publication_lag_days, updated_at)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
            on conflict (code) do update set
                name = excluded.name, commodity = excluded.commodity, region = excluded.region,
                unit = excluded.unit, frequency = excluded.frequency, source = excluded.source,
                source_ref = excluded.source_ref, description = excluded.description,
                is_unofficial = excluded.is_unofficial, price_kind = excluded.price_kind,
                license = excluded.license, license_url = excluded.license_url,
                attribution = excluded.attribution,
                publication_lag_days = excluded.publication_lag_days,
                is_active = true, updated_at = now()
            returning id
            """,
            (
                spec.code,
                spec.name,
                spec.commodity,
                spec.region,
                spec.unit,
                spec.frequency,
                catalog.source,
                spec.source_ref,
                spec.description,
                spec.is_unofficial,
                spec.price_kind,
                licence.name,
                licence.url,
                licence.attribution,
                spec.publication_lag_days,
            ),
        ).fetchone()
        assert row is not None
        ids[spec.code] = int(row[0])
    return ids


def last_observations(conn: psycopg.Connection, series_ids: Iterable[int]) -> dict[int, datetime]:
    rows = conn.execute(
        "select series_id, max(ts) from market.observations"
        " where series_id = any(%s) group by series_id",
        (list(series_ids),),
    ).fetchall()
    return {int(series_id): ts for series_id, ts in rows}


def upsert_observations(
    conn: psycopg.Connection,
    series_ids: dict[str, int],
    observations: list[Observation],
) -> int:
    """Insert new observations and overwrite revised values. Returns rows inserted or changed.

    Rows are copied into a temporary table first, which is much faster than row-by-row inserts for
    multi-year backfills.
    """
    if not observations:
        return 0
    # One temporary table per session, emptied before each batch (several batches may share a
    # transaction, e.g. during a backfill).
    conn.execute(
        "create temp table if not exists incoming"
        " (series_id bigint, ts timestamptz, value double precision) on commit delete rows"
    )
    conn.execute("truncate incoming")
    with conn.cursor().copy("copy incoming (series_id, ts, value) from stdin") as copy:
        for obs in observations:
            copy.write_row((series_ids[obs.series_code], obs.ts, obs.value))
    cursor = conn.execute(
        """
        insert into market.observations (series_id, ts, value)
        select series_id, ts, value from incoming
        on conflict (series_id, ts) do update
            set value = excluded.value, ingested_at = now()
            where market.observations.value is distinct from excluded.value
        """
    )
    return max(cursor.rowcount, 0)


def start_run(conn: psycopg.Connection, source: str) -> int:
    row = conn.execute(
        "insert into market.ingest_runs (source, status) values (%s, 'running') returning id",
        (source,),
    ).fetchone()
    assert row is not None
    return int(row[0])


def finish_run(
    conn: psycopg.Connection,
    run_id: int,
    status: str,
    rows_written: int,
    rows_rejected: int,
    error: str | None,
) -> None:
    if status not in RUN_STATUSES:
        raise ValueError(f"Unknown run status {status!r}")
    conn.execute(
        """
        update market.ingest_runs
        set finished_at = now(), status = %s, rows_written = %s, rows_rejected = %s, error = %s
        where id = %s
        """,
        (status, rows_written, rows_rejected, error[:MAX_ERROR_LENGTH] if error else None, run_id),
    )
