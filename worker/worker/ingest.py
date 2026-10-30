"""Command-line entry point for ingestion jobs.

    uv run python -m worker.ingest --source ecb --dry-run          # fetch + validate, no database
    uv run python -m worker.ingest --source ecb                    # incremental update
    uv run python -m worker.ingest --source ecb --backfill         # full history
    uv run python -m worker.ingest --source ecb --since 2024-01-01 --series fx.eurusd

Exit code 0 for ok and partial runs (partial runs are visible on /data), 1 for failed runs, 2 for
an unknown source.
"""

import argparse
import sys
from collections.abc import Callable, Sequence
from datetime import date

from worker import runner
from worker.sources.base import Source
from worker.sources.cftc import CftcSource
from worker.sources.ec_wob import EcWobSource
from worker.sources.ecb import EcbSource
from worker.sources.eia import EiaSource
from worker.sources.elexon import ElexonSource
from worker.sources.entsog import EntsogSource
from worker.sources.fred import FredSource
from worker.sources.gie import GieAgsiSource, GieAlsiSource
from worker.sources.odre import OdreSource
from worker.sources.smard import SmardSource
from worker.sources.yahoo import YahooSource

SOURCES: dict[str, Callable[[], Source]] = {
    "cftc": CftcSource,
    "ec_wob": EcWobSource,
    "ecb": EcbSource,
    "eia": EiaSource,
    "elexon": ElexonSource,
    "entsog": EntsogSource,
    "fred": FredSource,
    "gie_agsi": GieAgsiSource,
    "gie_alsi": GieAlsiSource,
    "odre": OdreSource,
    "smard": SmardSource,
    "yahoo": YahooSource,
}

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_UNKNOWN_SOURCE = 2


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="worker.ingest", description=__doc__.splitlines()[0])
    parser.add_argument("--source", required=True, help="source to ingest, e.g. ecb, eia, gie_agsi")
    parser.add_argument(
        "--dry-run", action="store_true", help="fetch and validate recent data, write nothing"
    )
    parser.add_argument("--backfill", action="store_true", help="fetch the full history")
    parser.add_argument(
        "--since", type=date.fromisoformat, help="fetch from this date (YYYY-MM-DD)"
    )
    parser.add_argument("--series", nargs="+", help="only these series codes")
    return parser.parse_args(argv)


def print_summary(summary: runner.RunSummary, dry_run: bool) -> None:
    mode = "DRY RUN — nothing written" if dry_run else f"{summary.rows_written} row(s) written"
    print(f"[{summary.source}] status={summary.status} · {mode}")
    for code, observations in summary.fetched.items():
        if observations:
            last = max(observations, key=lambda o: o.ts)
            first = min(observations, key=lambda o: o.ts)
            print(
                f"  {code}: {len(observations)} obs, {first.ts.date()} → {last.ts.date()},"
                f" last value {last.value}"
            )
        else:
            print(f"  {code}: no observations in the requested period")
    if summary.rows_rejected:
        print(f"  rejected rows: {summary.rows_rejected}")
    text = summary.error_text()
    if text:
        print("  problems:\n    " + text.replace("\n", "\n    "))


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    factory = SOURCES.get(args.source)
    if factory is None:
        available = ", ".join(sorted(SOURCES))
        print(f"Unknown or not yet implemented source: {args.source!r}. Available: {available}.")
        return EXIT_UNKNOWN_SOURCE
    summary = runner.run(
        factory(),
        dry_run=args.dry_run,
        backfill=args.backfill,
        since=args.since,
        only=set(args.series) if args.series else None,
    )
    print_summary(summary, args.dry_run)
    return EXIT_FAILED if summary.status == "failed" else EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
