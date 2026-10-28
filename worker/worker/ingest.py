"""Command-line entry point for ingestion jobs.

    uv run python -m worker.ingest --source eia --dry-run

Sources are registered from milestone M1. Until then every source is reported as not implemented,
so a scheduled job cannot silently succeed without writing data.
"""

import argparse
import sys
from collections.abc import Callable, Sequence

# Maps a source name to its ingestion function (arguments: dry_run). Filled in M1.
SOURCES: dict[str, Callable[[bool], int]] = {}

EXIT_OK = 0
EXIT_UNKNOWN_SOURCE = 2


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="worker.ingest", description=__doc__.splitlines()[0])
    parser.add_argument("--source", required=True, help="source to ingest, e.g. eia, gie_agsi")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="fetch and validate, but write nothing to the database",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    ingest = SOURCES.get(args.source)
    if ingest is None:
        available = ", ".join(sorted(SOURCES)) or "none yet (sources arrive in M1)"
        print(f"Unknown or not yet implemented source: {args.source!r}. Available: {available}.")
        return EXIT_UNKNOWN_SOURCE
    return ingest(args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
