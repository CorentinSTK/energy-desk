# CLAUDE.md — working rules for this repository

Read `BUILD_SPEC.md` before any planning. It defines scope, data sources, architecture, design and
milestones. If a request conflicts with it, point out the conflict and ask before proceeding.

## About the user

- The user (Corentin) is building this to learn and to show energy-trading employers what he can do.
  He must be able to explain every screen, model and number. When you make a non-obvious decision
  (library, model, formula, data choice), explain it in two or three plain sentences.
- He prefers to discuss in French; code, comments, commit messages and UI text are in English.

## How we work

1. **One milestone at a time** (see BUILD_SPEC §10). Start each milestone in plan mode: list the files,
   steps and checks, and wait for approval.
2. **Small, verifiable steps.** After each step: run lint, typecheck and relevant tests; fix before moving on.
3. **Show, don't claim.** Run the dev server or tests to verify behaviour before saying something works.
4. **End of milestone:** summarise what was built, how to see it, what is not done, and known limitations.
   Append a dated entry to `docs/SESSION_LOG.md`.
5. **Update docs with code.** If a decision changes, update `BUILD_SPEC.md` in the same commit;
   record significant choices as a short ADR in `docs/adr/`.
6. Commit in small, logical commits with conventional messages (`feat:`, `fix:`, `chore:`, `docs:`).
   Do not push or deploy without the user's go-ahead.

## Data integrity (non-negotiable)

- **Never fabricate, interpolate or "fill in" market data.** If a source is unavailable, show the gap.
- Verify every API endpoint and series ID with a live request before building on it.
- Store values in source units; convert only through the `units` module; label units everywhere.
- Never mix spot and futures, or physical and paper prices, in one spread.
- Every displayed number must be traceable to a row in `observations` (or a documented computation).
- No paid or licensed data in the repo or database.

## Security

- Never commit secrets. Use `.env.local` (web) and `worker/.env` (worker), both gitignored;
  keep `.env.example` files up to date with every variable name and a short description.
- Public pages use only the read-only database role. The service key is used only by the worker.
- Validate and bound all user inputs (Lab parameters, date ranges); no arbitrary code execution.

## Code conventions

- **Web:** TypeScript strict; server components by default, client components only for interactivity;
  data access in `apps/web/src/lib/data/`; reusable UI in `apps/web/src/components/`; no inline magic
  numbers or colours (use design tokens); every chart goes through the shared `ChartCard` + chart theme.
- **Worker:** one module per source in `worker/sources/`; shared HTTP client with retries and timeouts;
  pydantic models for configs; pure functions for transforms with unit tests in `worker/tests/`.
- **SQL:** migrations in `db/migrations/NNN_description.sql`, never edited once applied.
- Prefer clarity over cleverness; small functions; docstrings for any non-obvious logic.

## Commands (keep this section up to date as the project is scaffolded)

```bash
# web (run from the repo root; npm workspace "web" = apps/web)
npm install
npm run dev          # http://localhost:3000 — style guide at /styleguide
npm run lint && npm run typecheck && npm run format:check && npm run test
npm run build
npm run test:e2e     # Playwright smoke tests (dev server locally; CI=1 uses the production build)
PLAYWRIGHT_BASE_URL=https://energy-desk-two.vercel.app npm run test:e2e   # against the live site
npm run format       # apply Prettier

# worker (Python 3.12, pinned by uv)
cd worker
uv sync
uv run pytest
uv run ruff check . && uv run ruff format --check . && uv run mypy
uv run python -m worker.ingest --source eia --dry-run
```

## Git workflow

`main` is protected (required checks: `web`, `worker`). Work on a branch, open a PR, merge when CI
is green. Vercel deploys `main` to production and every PR to a preview URL.

## Definition of done (every feature)

- Works in both themes, on desktop and mobile widths.
- Loading, empty, error and stale states handled.
- Source, unit, last date and methodology shown for every chart.
- Lint, typecheck, tests and build pass.
- The user has seen it and can explain it.
