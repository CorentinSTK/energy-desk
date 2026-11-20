# ADR 0012 — Precomputed catalogue coverage

- Status: accepted
- Date: 2026-11-19

## Context

On the live site, every page streamed its data about 3 s after the page shell. Timing logs on
Vercel (PR #42) showed where the time went:
- the function runs in `fra1`, next to the database, and stays warm between visits;
- series queries take 2 to 50 ms;
- the catalogue (`web.series_catalog`) takes about 2.5 s on every visit.

Every page reads the catalogue, for source footers and freshness, and `web.series_snapshot` reads it
too. The view (migrations 001 and 004) computed observation counts, first and last dates and gaps with
a window function over the whole `observations` table, on every read.

The Next.js `use cache` layer did not hide this cost on Vercel: most cached functions missed on a warm
instance. That is a separate issue. Relying on the cache would also leave the first visit on each
instance slow.

## Decision

- Migration 009 moves the coverage figures into a **materialized view**, `market.series_coverage`.
  It has the same definitions as before: count, first, last, largest interval, and gaps above the
  series' threshold.
- `web.series_catalog` keeps its columns and joins the materialized view, so the site and the health
  check need no change.
- The worker refreshes it with `refresh materialized view concurrently` at the end of every ingestion
  run that wrote data (`store.refresh_coverage`). `concurrently` keeps the previous figures readable
  while the new ones are computed.
- If the refresh fails, the data stays committed and the run is marked `partial` with "catalogue
  coverage not refreshed". `/data` and the health check show it.
- A database test checks that the precomputed figures equal the live calculation from 004.

## Consequences

- Reading the catalogue costs a join on about 400 rows instead of a scan of every observation.
- The coverage figures are exactly as fresh as the last ingestion run. Observations only change
  during a run, so this loses nothing. A series added by a catalogue sync shows 0 observations until
  the end of that run.
- Each run spends a few seconds on the refresh, a few times a day.
- Any new code path that writes observations must call `store.refresh_coverage`. The runner is the
  only one today. The CI fixture, which inserts rows directly, refreshes once at the end.

## Extension (2026-11-20, migration 010)

The home page's `web.series_snapshot(codes)` computed each series' move z-score, 5-year percentile
and seasonal gap on every call: about 23 ms per series, about 500 ms per home page view. These
measures also depend only on stored observations, so they follow the same pattern:
- The 006 calculation is moved, unchanged, to `market.compute_series_snapshot`. It is not executable
  by the site.
- `market.series_snapshots` stores its result for every catalogue series.
- `web.series_snapshot` keeps its signature and reads the stored rows through `web.series_snapshots`.
- `store.refresh_coverage` became `store.refresh_summaries`. It refreshes the coverage first, then
  the snapshots, which list the catalogue's series. A run spends about 10 s more on it.
- A database test checks that the stored rows equal the calculation.
