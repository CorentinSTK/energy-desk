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
