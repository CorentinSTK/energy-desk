# ADR 0003 — Yahoo Finance (yfinance) for futures: optional, derived, labelled

- Status: accepted
- Date: 2026-10-28

## Context

Exchange futures prices (CME/NYMEX, ICE, EEX) are licensed, and there is no free official source for
futures curves. Yahoo Finance gives delayed futures data through the unofficial `yfinance` library, but it
has no API contract or licence for redistribution, and it often rate-limits or blocks cloud IPs such as
GitHub Actions runners.

Checked on 2026-10-28: on Yahoo, `BZ=F` and `TTF=F` are NYMEX contracts (a financially settled Brent
look-alike and the NYMEX Dutch TTF contract), not ICE Brent or ICE Endex TTF. ICE gasoil and NBP are not
available.

## Decision

We use Yahoo only for futures, under these rules:

1. **Optional source.** If a fetch fails or is blocked, the run is recorded as `partial` or `failed` in
   `ingest_runs`, and the UI shows a data gap. No page or job depends on it to render or finish.
2. **Rate limits on GitHub Actions.**
   - One run per day, after US settlement.
   - Requests are sequential with random jitter, in small ticker batches.
   - Bounded retries (tenacity, exponential backoff) that stop on HTTP 429 instead of hammering.
   - A total time budget per run.
   - No retry storm across jobs.
   - `yfinance` is pinned and isolated in `worker/sources/yahoo.py`, so it can be replaced.
3. **Derived indicators first.** The site shows calendar spreads, curve structure (contango/backwardation),
   percentiles and z-scores, not raw price tables. Raw settles stay in `futures_contracts`, which the
   public read-only role cannot read. The site reads only derived views.
4. **Label.** Every affected chart shows "Yahoo Finance — unofficial, delayed, research only" and names the
   actual contract and exchange (e.g. "NYMEX Brent financial", not "ICE Brent").
5. **Official sources only for spot, stocks and fundamentals.** Yahoo is never used for these, and futures
   are never mixed with spot in one spread.
6. `/methodology` has a **Data licensing** section explaining that CME, ICE and EEX prices are licensed and
   not redistributed here.

## Consequences

- Curves may be partial or missing on some days. That is acceptable and shown as such.
- If Yahoo becomes unusable, futures indicators disappear and nothing else is affected.
- Revisit this decision if a free official or properly licensed source appears.

## Amendment — 2026-10-28 (M2)

- **Display.** A front-month level may appear as a single KPI value with the unofficial label. Charts
  show derived indicators only: calendar spread (M1–M2), percentile and z-score of the front month.
  No chart or table of raw settlements.
- **Where derived values are computed.** In the worker, from `market.futures_contracts`, stored as
  series with `is_unofficial = true` and `price_kind = 'futures'`. The site reads them like any other
  series, and `web_reader` cannot read the raw table at all.
- **Coverage.** For TTF only the first two monthly contracts are listed on Yahoo, so there is no full
  curve. Spread history starts at the first ingestion and is labelled as such.
