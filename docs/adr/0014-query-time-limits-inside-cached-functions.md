# ADR 0014 — Query time limits inside cached functions

- Status: accepted
- Date: 2026-11-25

## Context

PR #52 limited every data load to 10 s with `timed()`, around each cached query. After the rollout,
the freight chokepoint table still failed on about one request in two on the live site:
- the response took 10.3 s;
- the table showed "—" in every cell, with no error state.

Other cards on the same page, and other pages, were fine. Locally, against the production database,
the table always loaded.

Next 16.4.6 deduplicates `use cache` invocations per server instance
(`ResolvableSharedCacheResult` in `use-cache-wrapper.js`). A generation stays in the dedup map until
its result stream is fully collected, and every later read of the same key joins it. If a generation
never finishes, every request served by that instance waits on it until the outer limit.

The 10 s limit sat outside the cache boundary. It abandoned the wait but could not end the
generation. Ending the generation relied on postgres.js failing the hung query after the pool was
reset. It does so locally; on Vercel, the repeated 10 s responses suggest it did not.

Why `getPointsMany` hung is not established: the Vercel runtime logs were not read for this change.

## Decision

- Every SQL query runs through `query(label, sql => …)` (`lib/data/query.ts`), called inside the
  cached function.
  - Each attempt is limited to 4 s. On a timeout, the pool is replaced and the query is retried once.
  - A second timeout rejects. The generation then fails: nothing is cached, the dedup entry is
    dropped, and the next request queries again.
  - Two attempts (8 s) fit inside the page-level limit, which stays at 10 s as a safety net.
- `resetDb()` ends the old pool with a 5 s grace period instead of 0 s. Closing it at once also failed
  the healthy queries running beside the hung one.
- The chokepoint table shows the standard error state when its load fails. Before, it showed "—",
  which reads as "no data".

## Consequences

- A hung query costs one request at most 8 s, then that card shows an error. It can no longer
  block one card on an instance for as long as the instance lives.
- `query_timeout` is now logged per attempt (`attempt: 1 | 2`), from inside the cached function. The
  page-level `query_timeout` should no longer appear. If it does, something other than SQL hung.
- Checked with a local TCP proxy that freezes the database connection: the page ends with an error
  card, and the next request after the freeze loads normally. The proxy did not reproduce the old
  failure: there, postgres.js did fail the hung query.
