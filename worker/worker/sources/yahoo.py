"""Yahoo Finance futures (unofficial, optional; ADR 0003). TTF only for now.

Two series reach the site, both flagged unofficial:
- `yahoo.ttf.front_month`: Yahoo's continuous front month (TTF=F). Shown only as a single KPI value.
- `yahoo.ttf.m1_m2_spread`: M1 minus M2, a derived indicator (positive = backwardation).
Raw settlements of the individual contracts go to `market.futures_contracts`, which the site cannot
read; they make every derived value traceable.

Checked live on 2026-10-28:
- These are NYMEX contracts (Dutch TTF, Platts-based), not ICE Endex TTF. Labels say so.
- Daily data needs explicit `period1`/`period2`: with `range=max` Yahoo returns coarser points.
- Only contracts still trading are listed (e.g. X26, Z26, F27, G27 on 28 Oct 2026); expired ones are
  gone. So for a date D, M1 is strictly the month after D and M2 the month after that; if either has
  no close that day, there is no spread value (never the next available pair, which would mislabel a
  further spread as M1-M2). History therefore starts short and grows as we store settlements daily.
- Closes are dated in the exchange time zone (America/New_York). Null closes are skipped.
- No retries: a 429 or a block ends the series for this run (partial run; the page shows a gap).
"""

import time
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import psycopg

from worker.catalog import SeriesSpec
from worker.http_client import get_once
from worker.sources.base import Source
from worker.validate import Observation

URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
MONTH_CODES = "FGHJKMNQUVXZ"  # futures month letters, January to December
FRONT_MONTH_START = date(2017, 1, 1)
CONTRACT_HISTORY_START = date(2025, 1, 1)
CONTRACTS_AHEAD = 4  # contracts to request beyond the current month


def contract_ticker(root: str, delivery_month: date) -> str:
    """TTF + December 2026 → 'TTFZ26.NYM'."""
    return f"{root}{MONTH_CODES[delivery_month.month - 1]}{delivery_month.year % 100:02d}.NYM"


def add_months(day: date, months: int) -> date:
    index = day.year * 12 + day.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def parse_chart(body: dict[str, Any]) -> list[tuple[date, float]]:
    """(trading date in the exchange time zone, close) pairs; null closes skipped."""
    result = (body.get("chart", {}).get("result") or [None])[0]
    if not result:
        return []
    tz = ZoneInfo(result["meta"].get("exchangeTimezoneName") or "America/New_York")
    closes = result["indicators"]["quote"][0]["close"]
    points = []
    for stamp, close in zip(result.get("timestamp") or [], closes, strict=True):
        if close is None:
            continue
        points.append((datetime.fromtimestamp(stamp, tz).date(), float(close)))
    return points


def m1_m2_spread(settles: dict[date, dict[date, float]]) -> list[tuple[date, float]]:
    """Spread M1 - M2 per trading date, from settlements keyed by delivery month then date.

    M1 is the month after the trading date, M2 the month after that. A date where either is
    missing has no value.
    """
    dates = sorted({d for by_date in settles.values() for d in by_date})
    spread = []
    for d in dates:
        m1 = settles.get(add_months(d, 1), {}).get(d)
        m2 = settles.get(add_months(d, 2), {}).get(d)
        if m1 is not None and m2 is not None:
            spread.append((d, m1 - m2))
    return spread


def at_midnight_utc(day: date) -> datetime:
    return datetime(day.year, day.month, day.day, tzinfo=UTC)


class YahooSource(Source):
    name = "yahoo"
    lookback = timedelta(days=10)
    request_interval = 2.5

    def __init__(self, today: Callable[[], date] = date.today) -> None:
        self._today = today
        self._settles: dict[date, dict[date, float]] = {}  # delivery month → date → close
        self._fetched_contracts = False

    def _chart(self, client: httpx.Client, ticker: str, since: date) -> list[tuple[date, float]]:
        params = {
            "period1": int(at_midnight_utc(since).timestamp()),
            "period2": int(at_midnight_utc(self._today() + timedelta(days=1)).timestamp()),
            "interval": "1d",
        }
        response = get_once(client, URL.format(ticker=ticker), params)
        return parse_chart(response.json())

    def _contracts(self, client: httpx.Client, root: str, since: date) -> None:
        """Fetch the next contracts once per run. A contract Yahoo does not list is skipped."""
        if self._fetched_contracts:
            return
        self._fetched_contracts = True
        first = add_months(self._today(), 0)
        for offset in range(CONTRACTS_AHEAD + 1):
            delivery = add_months(first, offset)
            time.sleep(self.request_interval)
            try:
                points = self._chart(client, contract_ticker(root, delivery), since)
            except Exception as error:
                if getattr(error, "status_code", None) == 404:
                    continue  # not (or no longer) listed
                raise
            self._settles[delivery] = dict(points)

    def fetch(
        self, client: httpx.Client, spec: SeriesSpec, since: date | None
    ) -> list[Observation]:
        if spec.source_ref == "TTF=F":
            points = self._chart(client, "TTF=F", since or FRONT_MONTH_START)
            return [Observation(spec.code, at_midnight_utc(d), v) for d, v in points]
        if spec.source_ref == "TTF|m1-m2":
            self._contracts(
                client, "TTF", min(since or CONTRACT_HISTORY_START, CONTRACT_HISTORY_START)
            )
            return [
                Observation(spec.code, at_midnight_utc(d), v)
                for d, v in m1_m2_spread(self._settles)
            ]
        raise ValueError(f"Unknown Yahoo series reference {spec.source_ref!r}")

    def persist(self, conn: psycopg.Connection) -> int:
        """Raw contract settlements → market.futures_contracts (never readable by the site)."""
        rows = [
            (contract_ticker("TTF", delivery), "TTF", "NYMEX", delivery, at_midnight_utc(d), close)
            for delivery, by_date in self._settles.items()
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
