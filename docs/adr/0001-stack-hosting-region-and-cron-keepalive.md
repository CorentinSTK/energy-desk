# ADR 0001 — Stack, monorepo, hosting region and cron keep-alive

- Status: accepted
- Date: 2026-10-28

## Context

The site (Next.js) and the data worker (Python) live in one public GitHub repository. The site runs on
Vercel, the database on Supabase, and ingestion on GitHub Actions cron. The platform focuses on Europe,
and its main users are in London, Berlin and Paris.

## Decisions

### Monorepo and runtimes

- npm workspaces at the root, with one workspace (`apps/web`). There is only one JS app, so Turborepo
  or pnpm would add tooling without benefit. Root scripts (`npm run dev`, `lint`, `typecheck`, `test`,
  `build`) delegate to the workspace.
- Node 24 LTS, pinned in `.nvmrc` and in CI.
- Python 3.12 for the worker, pinned with uv (`.python-version` + `requires-python`). 3.12 is mature and
  supported by every library we plan to use (pandas, statsmodels, scikit-learn, lightgbm).

### Region: Frankfurt for both Supabase and Vercel functions

Supabase `eu-central-1` and Vercel `fra1`. London (`eu-west-2` / `lhr1`) was the alternative.

- **Same AWS region.** Both providers run on AWS, so Frankfurt ↔ Frankfurt keeps every server-rendered
  database query inside one region (about 1–2 ms instead of tens of ms). Latency between the function
  and the database matters most, because a page makes several queries.
- **Central to the users.** Frankfurt is about 10–15 ms from Berlin, Paris and London alike. London would
  favour one city out of three.
- **Feature availability.** eu-central-1 is the most established AWS region in the EU, and new provider
  features usually arrive there early.
- Static and cached pages come from Vercel's global edge network, so the region only affects dynamic
  rendering and route handlers.

Vercel's default function region is `iad1` (US East). It must be set to `fra1` when the project is created
(project settings, or `"regions": ["fra1"]` in `vercel.json`).

### Cron keep-alive

GitHub disables scheduled workflows in public repositories after 60 days without repository activity.
Ingestion would then stop silently.

- A monthly workflow (in M1) writes `ops/heartbeat.json` (date and workflow run ID) and commits it to
  a dedicated `ops/heartbeat` branch. A separate branch keeps `main` history clean and avoids conflicts
  with branch protection, which requires CI checks on `main`.
- Implemented in M1 (`.github/workflows/keepalive.yml`). The job logic was tested on a local repository:
  the first run creates the orphan branch, later runs add a commit, and `main` is untouched. That a
  bot commit resets GitHub's 60-day timer cannot be observed without waiting 60 days. If it turns out
  not to, the fallback is a monthly call to the GitHub API endpoint that re-enables each scheduled
  workflow.
- Defence in depth: `/data` flags stale sources, so a stopped cron is visible on the site.

## Consequences

- One repository, one CI workflow with a `web` job and a `worker` job.
- The Vercel project setup must include the region; we check it at deploy time.
- The repository gets a bot commit on a side branch once a month.
