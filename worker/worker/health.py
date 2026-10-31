"""Health check of the live site and its data, run by the Health workflow (ADR 0011).

    uv run python -m worker.health            # exit 1 and a list of problems if anything is wrong

Checks, each reported on its own line:
- pages: each key page answers 200 and does not show the site's error state;
- data: no series is "stale" by the site's own rule (apps/web/src/lib/freshness.ts, mirrored here
  and kept in step by a test), and the latest ingestion run of each source did not fail;
- forecasts: a live forecast was issued in the last 36 hours.
It reads the database with the site's read-only role (DATABASE_URL_READONLY). A failure fails the
workflow, and GitHub emails the repository owner.
"""

import os
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import httpx
import psycopg

SITE_URL = "https://energy-desk-two.vercel.app"
PAGES = (
    "/",
    "/markets/gas",
    "/markets/lng",
    "/markets/power",
    "/markets/crude",
    "/markets/products",
    "/forecasts",
    "/lab",
    "/data",
    "/methodology",
)
# Texts of the site's error states (ErrorState titles and descriptions).
ERROR_MARKERS = ("did not respond", "is unavailable", "could not be loaded")
# Same values as FRESHNESS_THRESHOLDS_DAYS[...].delayed in apps/web/src/lib/freshness.ts.
STALE_AFTER_DAYS = {"half_hourly": 3, "hourly": 3, "daily": 7, "weekly": 17, "monthly": 75}
FORECAST_MAX_AGE = timedelta(hours=36)


@dataclass(frozen=True)
class Problem:
    check: str
    detail: str


def page_problems(client: httpx.Client, base: str, paths: Sequence[str]) -> list[Problem]:
    problems = []
    for path in paths:
        try:
            response = client.get(base + path)
        except httpx.HTTPError as error:
            problems.append(Problem("page", f"{path}: {type(error).__name__}"))
            continue
        if response.status_code != 200:
            problems.append(Problem("page", f"{path}: HTTP {response.status_code}"))
        elif any(marker in response.text for marker in ERROR_MARKERS):
            problems.append(Problem("page", f"{path}: shows an error state"))
    return problems


def stale_series(
    rows: Sequence[tuple[str, str, datetime | None, int]], now: datetime
) -> list[Problem]:
    """rows: (code, frequency, last observation, publication lag in days)."""
    problems = []
    for code, frequency, last, lag in rows:
        if last is None:
            continue  # never published: listed on /data, not a regression
        age_days = (now - last).total_seconds() / 86400 - lag
        if age_days > STALE_AFTER_DAYS[frequency]:
            problems.append(
                Problem("data", f"{code} is stale ({age_days:.0f} days beyond its lag)")
            )
    return problems


def failed_sources(rows: Sequence[tuple[str, str]]) -> list[Problem]:
    """rows: (source, status) of each source's latest run in the last 30 days."""
    return [
        Problem("ingest", f"{source}: latest run {status}")
        for source, status in rows
        if status == "failed"
    ]


def forecast_problem(latest_issue: datetime | None, now: datetime) -> list[Problem]:
    if latest_issue is None or now - latest_issue > FORECAST_MAX_AGE:
        when = "never" if latest_issue is None else latest_issue.isoformat()
        return [Problem("forecast", f"no live forecast in the last 36 hours (latest: {when})")]
    return []


def data_problems(conn: psycopg.Connection, now: datetime) -> list[Problem]:
    series = conn.execute(
        "select code, frequency, last_observation, publication_lag_days from web.series_catalog"
    ).fetchall()
    runs = conn.execute(
        "select distinct on (source) source, status from web.ingest_runs_recent"
        " where status <> 'running' order by source, started_at desc"
    ).fetchall()
    latest = conn.execute("select max(issued_at) from web.forecasts where kind = 'live'").fetchone()
    return [
        *stale_series(series, now),
        *failed_sources(runs),
        *forecast_problem(latest[0] if latest else None, now),
    ]


def main() -> int:
    now = datetime.now(UTC)
    base = os.environ.get("SITE_URL", SITE_URL).rstrip("/")
    with httpx.Client(timeout=60, follow_redirects=True) as client:
        problems = page_problems(client, base, PAGES)
    url = os.environ.get("DATABASE_URL_READONLY")
    if url:
        with psycopg.connect(url) as conn:
            problems += data_problems(conn, now)
    else:
        problems.append(Problem("config", "DATABASE_URL_READONLY is not set: data not checked"))
    print(f"Checked {len(PAGES)} pages and the data at {now:%Y-%m-%d %H:%M} UTC.")
    for p in problems:
        print(f"PROBLEM [{p.check}] {p.detail}")
    print("All good." if not problems else f"{len(problems)} problem(s).")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
