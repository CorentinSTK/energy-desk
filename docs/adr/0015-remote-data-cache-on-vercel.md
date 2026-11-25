# ADR 0015 — Remote data cache on Vercel

- Status: accepted
- Date: 2026-11-25

## Context

ADR 0012 noted that `use cache` rarely hit on Vercel. The `db_query` logs (PR #56) confirmed it:
- a freight page visit ran about 23 SQL queries, so nearly every cached function missed;
- the pool was always under 3 s old.

Next 16 documents this behaviour (`use-cache.md`, "Runtime Caching Behavior"): the default
`use cache` handler keeps entries in memory, and in serverless environments "cache entries typically
don't persist across requests". The directive meant for this case is `'use cache: remote'`, which
stores entries in the platform's shared cache. On Vercel, that is Runtime Cache.

Runtime Cache on Hobby (vercel.com/docs/runtime-cache, read 25 Nov 2026):
- 1M reads and 200K writes a month, shared by the team's projects;
- above that there is no charge, but the cache is paused for the rest of the period;
- the cache is regional (`fra1` here), items are limited to 2 MB, and entries from a previous
  deployment are not reused.

## Decision

- The 11 cached data functions in `apps/web/src/lib/data/` use `'use cache: remote'`.
- `cacheLife("hours")` is unchanged.
- Self-hosting and local runs fall back to the default in-memory handler. No configuration is needed.

## Consequences

- One visit fills the cache for every instance in `fra1`. Later visits read from Runtime Cache
  instead of Supabase, until the entry goes stale.
- Freshness is unchanged. Data can lag an ingest by up to the `hours` profile, as before.
- Budget: a page reads about 25 entries, so 1M reads is about 40,000 page views a month. If the quota
  runs out, the site falls back to querying the database, as it does today. Nothing breaks.
- The `db_query` log showed the hit rate: fewer lines per visit meant more hits. Since 2026-11-25 it
  logs only queries of 1 s or more and retries (`SLOW_QUERY_MS`), to keep the logs readable.
