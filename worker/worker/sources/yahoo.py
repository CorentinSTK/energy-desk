"""Yahoo Finance futures (unofficial, optional; ADR 0003 and ADR 0007).

What reaches the site, every series flagged unofficial:
- Front-month levels (`TTF=F`, `CL=F`, `BZ=F`): Yahoo's continuous contract, shown as a single KPI.
- Calendar spreads M1 - Mn ("<root>|m1-m<n>"): derived indicators, positive = backwardation.
Raw settlements of the individual contracts go to `market.futures_contracts`, which the site cannot
read; they make every derived value traceable.

Checked live on 2026-10-28 (TTF) and 2026-10-30 (CL, BZ, HO, RB):
- All are NYMEX contracts: Dutch TTF (Platts), WTI, Brent Last Day Financial (a look-alike settled
  on ICE Brent, not ICE Brent itself), NY Harbor ULSD, RBOB. Labels say so.
- Daily data needs explicit `period1`/`period2`: with `range=max` Yahoo returns coarser points.
- Only contracts still trading are listed: TTF two or three months ahead, the oil contracts beyond
  December 2027. Expired contracts are gone, so spread history starts short and grows as we store
  settlements daily. M1 follows each exchange's expiry rule (worker/futures.py); a date where the
  front contract or any tenor is missing has no value for that spread, never a relabelled one.
- Closes are dated in the exchange time zone (America/New_York). Null closes are skipped.
- No retries: a 429 or a block ends the series for this run (partial run; the page shows a gap).
"""

import re
import time
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import psycopg

from worker.catalog import SeriesSpec
from worker.futures import add_months, calendar_spreads, contract_ticker, front_delivery
from worker.http_client import get_once
from worker.sources.base import Source
from worker.validate import Observation

URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
FRONT_MONTH_START = date(2017, 1, 1)
CONTRACT_HISTORY_START = date(2025, 1, 1)
# Generic months to rebuild per root (M1..Mn). One contract before the rule's front is requested
# too, so a holiday-shifted expiry is detected rather than missed.
TENORS = {"TTF": 4, "CL": 12, "BZ": 12, "HO": 6, "RB": 6}
SPREAD_REF = re.compile(r"^(?P<root>[A-Z]+)\|m1-m(?P<tenor>\d+)$")


def parse_chart(body: dict[str, Any]) -> list[tuple[date, float]]:
    """(trading date in the exchange time zone, close) pairs; null closes skipped.

    Continuous tickers (e.g. CL=F) can end with an extra live-quote point dated the same day as
    the last daily bar: only the first point of each date (the daily bar) is kept.
    """
    result = (body.get("chart", {}).get("result") or [None])[0]
    if not result:
        return []
    tz = ZoneInfo(result["meta"].get("exchangeTimezoneName") or "America/New_York")
    closes = result["indicators"]["quote"][0]["close"]
    points: dict[date, float] = {}
    for stamp, close in zip(result.get("timestamp") or [], closes, strict=True):
        day = datetime.fromtimestamp(stamp, tz).date()
        if close is not None and day not in points:
            points[day] = float(close)
    return list(points.items())


def at_midnight_utc(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=UTC)


class YahooSource(Source):
    name = "yahoo"
    lookback = timedelta(days=10)
    request_interval = 2.5

    def __init__(self, today: Callable[[], date] = date.today) -> None:
        self._today = today
        # root → delivery month → trading date → close
        self._settles: dict[str, dict[date, dict[date, float]]] = {}
        self._spreads: dict[str, dict[int, list[tuple[date, float]]]] = {}

    def _chart(self, client: httpx.Client, ticker: str, since: date) -> list[tuple[date, float]]:
        params = {
            "period1": int(at_midnight_utc(since).timestamp()),
            "period2": int(at_midnight_utc(self._today() + timedelta(days=1)).timestamp()),
            "interval": "1d",
        }
        response = get_once(client, URL.format(ticker=ticker), params)
        return parse_chart(response.json())

    def _contracts(
        self, client: httpx.Client, root: str, since: date
    ) -> dict[date, dict[date, float]]:
        """Fetch a root's contracts once per run. A contract Yahoo does not list is skipped."""
        if root not in self._settles:
            settles: dict[date, dict[date, float]] = {}
            front = front_delivery(root, self._today())
            for offset in range(-1, TENORS[root]):
                delivery = add_months(front, offset)
                time.sleep(self.request_interval)
                try:
                    points = self._chart(client, contract_ticker(root, delivery), since)
                except Exception as error:
                    if getattr(error, "status_code", None) == 404:
                        continue  # not (or no longer) listed
                    raise
                settles[delivery] = dict(points)
            self._settles[root] = settles
        return self._settles[root]

    def _spread(
        self, client: httpx.Client, root: str, tenor: int, since: date | None
    ) -> list[tuple[date, float]]:
        if root not in self._spreads:
            start = min(since or CONTRACT_HISTORY_START, CONTRACT_HISTORY_START)
            settles = self._contracts(client, root, start)
            self._spreads[root] = calendar_spreads(settles, root, list(range(2, TENORS[root] + 1)))
        return self._spreads[root][tenor]

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        ref = spec.source_ref
        if ref.endswith("=F"):
            points = self._chart(client, ref, since or FRONT_MONTH_START)
        elif match := SPREAD_REF.match(ref):
            points = self._spread(client, match["root"], int(match["tenor"]), since)
        else:
            raise ValueError(f"Unknown Yahoo series reference {ref!r}")
        return [Observation(spec.code, at_midnight_utc(d), v) for d, v in points]

    def persist(self, conn: psycopg.Connection) -> int:
        """Raw contract settlements → market.futures_contracts (never readable by the site)."""
        rows = [
            (contract_ticker(root, delivery), root, "NYMEX", delivery, at_midnight_utc(d), close)
            for root, by_delivery in self._settles.items()
            for delivery, by_date in by_delivery.items()
            for d, close in by_date.items()
        ]
        if not rows:
            return 0
        with conn.cursor() as cur:
            cur.executemany(
                """
                insert into market.futures_contracts
                    (contract, root, exchange, delivery_month, ts, settle, source)
                values (%s, %s, %s, %s, %s, %s, 'yahoo')
                on conflict (contract, ts) do update
                    set settle = excluded.settle, ingested_at = now()
                    where market.futures_contracts.settle is distinct from excluded.settle
                """,
                rows,
            )
        return len(rows)
