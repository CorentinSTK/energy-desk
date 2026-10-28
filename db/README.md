# Database

Supabase Postgres 17. Migrations live in `migrations/NNN_description.sql` and are applied in order by
the worker:

```bash
cd worker
uv run python -m worker.migrate --status   # what is applied, what is pending
uv run python -m worker.migrate            # apply pending migrations
```

A migration is never edited once applied: the runner stores a checksum of every applied file and stops
if one changes. Changes go in a new migration.

Layout (ADR 0005):

- `market`: tables (`series`, `observations`, `ingest_runs`, `futures_contracts`), written only by the
  worker. `futures_contracts` holds unofficial raw settlements and is never readable by the site.
- `web`: what the site reads through the `web_reader` role: `series_catalog`, `ingest_runs_recent`,
  `observations`, and the function `seasonal_daily(code, year)` (5-year min, max and mean by calendar day).
- `ops`: migration bookkeeping.

None of these schemas is exposed by the Supabase API, and Row Level Security is enabled on every table.

Database tests (`worker/tests/db/`) run against a real Postgres: in CI a `postgres:17` service; locally
any disposable server, via `TEST_DATABASE_URL`.
