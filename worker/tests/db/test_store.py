"""Catalogue sync, upserts and full runs against a real Postgres."""

from datetime import UTC, datetime

import psycopg
import pytest

from tests.test_runner import NOW, FakeSource
from worker import runner, store
from worker.catalog import load_catalog
from worker.validate import Observation

TS = datetime(2026, 10, 27, tzinfo=UTC)


def test_sync_series_inserts_then_updates(conn: psycopg.Connection) -> None:
    catalog = load_catalog("ecb")
    first = store.sync_series(conn, catalog)
    second = store.sync_series(conn, catalog)
    assert first == second
    licence, attribution = conn.execute(
        "select license, attribution from market.series where code = 'fx.eurusd'"
    ).fetchone() or (None, None)
    assert attribution == "Source: ECB statistics."
    assert licence and licence.startswith("ECB statistics")


def test_upsert_counts_new_and_revised_rows_only(conn: psycopg.Connection) -> None:
    ids = store.sync_series(conn, load_catalog("ecb"))
    rows = [Observation("fx.eurusd", TS, 1.10), Observation("fx.eurgbp", TS, 0.84)]
    assert store.upsert_observations(conn, ids, rows) == 2
    assert store.upsert_observations(conn, ids, rows) == 0  # unchanged: nothing rewritten
    revised = [Observation("fx.eurusd", TS, 1.11)]
    assert store.upsert_observations(conn, ids, revised) == 1
    value = conn.execute(
        "select value from market.observations where series_id = %s and ts = %s",
        (ids["fx.eurusd"], TS),
    ).fetchone()
    assert value == (1.11,)


def test_finish_run_rejects_unknown_status(conn: psycopg.Connection) -> None:
    run_id = store.start_run(conn, "ecb")
    with pytest.raises(ValueError):
        store.finish_run(conn, run_id, "great", 0, 0, None)


def test_full_run_writes_rows_and_logs_the_run(
    database_url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", database_url)
    summary = runner.run(FakeSource(failing={"fx.eurgbp"}), dry_run=False, now=NOW)
    assert summary.status == "partial"
    assert summary.rows_written == 1

    with psycopg.connect(database_url) as conn:
        status, written, error = conn.execute(
            "select status, rows_written, error from market.ingest_runs"
            " where source = 'ecb' order by id desc limit 1"
        ).fetchone() or (None, None, None)
        assert (status, written) == ("partial", 1)
        assert error and "fx.eurgbp" in error

        # Second run: incremental start = last observation minus the lookback window.
        source = FakeSource()
        runner.run(source, dry_run=False, now=NOW)
        last = (NOW - source.lookback - (NOW - TS)).date()
        assert source.starts["fx.eurusd"] == last
        assert source.starts["fx.eurgbp"] is None  # never ingested yet: full history

        conn.execute("delete from market.observations")
        conn.execute("delete from market.ingest_runs")
        conn.execute("delete from market.series")
        conn.commit()


def test_yahoo_raw_settlements_are_persisted(conn: psycopg.Connection) -> None:
    from datetime import date

    from worker.sources.yahoo import YahooSource

    source = YahooSource()
    source._settles = {date(2026, 12, 1): {date(2026, 10, 28): 99.1}}
    assert source.persist(conn) == 1
    assert source.persist(conn) == 1  # idempotent upsert on (contract, ts)
    row = conn.execute(
        "select contract, exchange, delivery_month, settle from market.futures_contracts"
    ).fetchone()
    assert row == ("TTFZ26.NYM", "NYMEX", date(2026, 12, 1), 99.1)
