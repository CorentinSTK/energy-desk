import re
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import respx

from worker.health import (
    STALE_AFTER_DAYS,
    failed_sources,
    forecast_problem,
    page_problems,
    stale_series,
)

NOW = datetime(2026, 10, 31, 12, tzinfo=UTC)
FRESHNESS_TS = Path(__file__).resolve().parents[2] / "apps/web/src/lib/freshness.ts"


def test_stale_thresholds_match_the_site() -> None:
    text = FRESHNESS_TS.read_text()
    site = {
        m["freq"]: float(m["delayed"])
        for m in re.finditer(
            r"(?P<freq>\w+): \{ fresh: [\d.]+, delayed: (?P<delayed>[\d.]+) \}", text
        )
    }
    assert site == STALE_AFTER_DAYS


def test_stale_series_allow_for_the_publication_lag() -> None:
    rows = [
        ("eia.brent_spot", "daily", NOW - timedelta(days=15), 9),  # 6 days beyond the lag: fine
        ("agsi.eu.full", "daily", NOW - timedelta(days=9), 1),  # 8 days beyond: stale
        ("never", "daily", None, 0),
    ]
    problems = stale_series(rows, NOW)
    assert [p.detail.split()[0] for p in problems] == ["agsi.eu.full"]


def test_failed_runs_and_missing_forecasts() -> None:
    assert [
        p.detail for p in failed_sources([("odre", "failed"), ("eia", "ok"), ("smard", "partial")])
    ] == ["odre: latest run failed"]
    assert forecast_problem(NOW - timedelta(hours=20), NOW) == []
    assert forecast_problem(NOW - timedelta(hours=40), NOW)
    assert forecast_problem(None, NOW)[0].detail.endswith("(latest: never)")


@respx.mock
def test_pages_must_answer_without_the_error_state() -> None:
    respx.get("https://site.test/").mock(
        return_value=httpx.Response(200, text="<h1>Energy Desk</h1>")
    )
    respx.get("https://site.test/data").mock(
        return_value=httpx.Response(200, text="Our database did not respond.")
    )
    respx.get("https://site.test/gone").mock(return_value=httpx.Response(500))
    with httpx.Client() as client:
        problems = page_problems(client, "https://site.test", ["/", "/data", "/gone"])
    assert [p.detail for p in problems] == ["/data: shows an error state", "/gone: HTTP 500"]
