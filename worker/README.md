# Worker

Python 3.12 jobs that ingest data into Supabase, compute derived series, and run forecasts and
backtests. Scheduled by GitHub Actions. See `BUILD_SPEC.md` §5 and `CLAUDE.md`.

```bash
uv sync
uv run pytest
uv run ruff check . && uv run ruff format --check . && uv run mypy
uv run python -m worker.ingest --source eia --dry-run
```

Secrets live in `worker/.env` (gitignored); see `.env.example`.

## Layout

- `catalog/<source>.yaml`: the series of each source, with unit, frequency, licence and attribution
  (checked against the provider's terms on the date given), publication lag and plausible range.
- `worker/sources/<source>.py`: one module per source (GIE AGSI+ and ALSI share `gie.py`); each
  states what was checked live.
- `worker/runner.py`: fetch → validate → store → `ingest_runs`, for one source.
- `worker/units.py`: the only place values change unit or currency.
- `worker/migrate.py`: applies `db/migrations/`.

Scheduled runs: `.github/workflows/ingest.yml` (one cron per publication rhythm, or run manually with
an optional backfill). Migrations on the production database: `.github/workflows/db-migrate.yml`,
manual.
