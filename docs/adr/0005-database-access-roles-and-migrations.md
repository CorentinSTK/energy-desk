# ADR 0005 — Database access, roles and migrations

- Status: accepted
- Date: 2026-10-28

## Context

The site is public and read-only. The worker writes data. CLAUDE.md requires a read-only role for public
pages, the service credentials only in the worker, and migrations that are never edited once applied.
Supabase exposes the `public` schema through its REST API to the `anon` role by default.

## Decisions

### Schemas outside the Supabase API

- `market` holds the tables (`series`, `observations`, `ingest_runs`).
- `web` holds the views the site reads.
- `ops` holds migration bookkeeping.

The Supabase API only serves `public`, so none of this is reachable through it. Row Level Security is still
enabled on every table, with no policies, as a second barrier.

### Site: a dedicated `web_reader` role over a direct Postgres connection

The site connects to Postgres through the Supabase pooler in Frankfurt as `web_reader`. That role can only
`SELECT` from views in `web`.

We chose this over the Supabase JS client with the public `anon` key and RLS policies for three reasons:

- **Least privilege by construction.** The role cannot see tables at all, only the views written for the
  site. Raw tables that must not be public (e.g. unofficial futures data, ADR 0003) are simply not in
  `web`.
- **Plain SQL.** The `/data` statistics (window functions, gap detection) are views, so they are tested
  in SQL.
- **Nothing exposed client-side.** There is no key in the browser. Queries run in server components only.

The role is created without a login by migration 001. Its password is set by the owner in the Supabase
SQL editor and never appears in the repository.

### Worker: the database owner

The worker runs migrations (DDL) and ingestion with the owner connection (`DATABASE_URL`). This is the
equivalent of the Supabase service key, kept in `worker/.env` locally and in a GitHub Actions secret.

### Migrations: a small in-house runner

`worker/migrate.py` applies `db/migrations/NNN_description.sql` in order, each in its own transaction. It
records each file with its SHA-256 checksum in `ops.schema_migrations`, and stops if an applied migration
was modified or deleted. That turns the rule "never edit an applied migration" into a check.

We did not use the Supabase CLI, which expects a different folder and timestamped filenames.

### Storage conventions

- `ts` is `timestamptz` in UTC. Daily, weekly and monthly values are stored at 00:00 UTC of their
  reference date.
- A missing observation is a missing row. Values must be finite.
- Re-ingesting a date overwrites the value (upsert), so provider revisions replace earlier values.
  Revision history is not kept in phase 1.

## Consequences

- Every new view for the site needs a migration. `web_reader` gets `SELECT` on new views in `web` through
  default privileges.
- Database tests run against a real Postgres 17 in CI (service container) and locally.
