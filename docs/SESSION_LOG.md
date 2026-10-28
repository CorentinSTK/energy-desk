# Session log

Newest entries at the bottom. One entry per working session or milestone.

## 2026-10-28 — Kickoff and spec revision

- Checked the environment: git, Python 3.13 (worker will pin 3.12 via uv), gh logged in; Node 24 and uv
  installed by the user.
- Revised `BUILD_SPEC.md`: Europe focus (gas, LNG, power DE/FR/GB in phase 1), source licences, Yahoo
  Finance policy, Frankfurt region, cron keep-alive, milestones M0–M8, forecast model 2 = France daily
  power demand.
- ADRs 0001–0004 written.
- Verified live: Yahoo `BZ=F` / `TTF=F` are NYMEX contracts, ICE gasoil and NBP absent; ODRÉ licence is
  Licence Ouverte v2.0; Energy-Charts DE price is CC BY 4.0 from SMARD.
- Started M0, step 1 (repository and root files).

## 2026-10-28 — M0 steps 1–10 (local)

Built:
- npm workspace + Next.js 16.4 app (`apps/web`), TS strict, Tailwind v4, Prettier + ESLint.
- Design tokens for both themes (`src/styles/tokens.css`), dark by default, WCAG AA contrast test
  (it caught two light-theme colours below 4.5:1 on `muted`; fixed).
- shadcn/ui (Radix) primitives; project components: KpiCard, ChartCard, FreshnessBadge, MethodPopover,
  MarketHeader, DataGapNotice, EmptyState, ErrorState, skeletons, theme toggle, demo and unofficial labels.
- `format.ts` and `freshness.ts` with unit tests.
- Thin ECharts wrapper (ADR 0002): time-series and seasonal options built from tokens, unit-tested.
- `/styleguide` (noindex + robots disallow): every component in both themes side by side, synthetic data,
  DEMO banner on all 24 cards.
- Worker skeleton (Python 3.12 via uv; ruff, mypy strict, pytest), `db/migrations/` placeholder.
- Playwright smoke tests (desktop + mobile), CI workflow (`web` and `worker` jobs), `vercel.json` (`fra1`).
- Full CI sequence run locally: lint, typecheck, format, 138 unit tests, build, 10 e2e tests, worker checks.

Found and fixed while verifying in the browser: theme-toggle label differed between server and client
(hydration); KPI grid followed the viewport instead of its container (now container queries).

Not done (needs the user): create the public GitHub repo and push; choose a code licence; Vercel project
(root `apps/web`, region `fra1`); branch protection on `main`.

Known limitations: freshness thresholds are generic per frequency until M1 records real publication
schedules; 3 low-severity npm audit findings in the shadcn CLI (dev only, via `deepmerge`).
