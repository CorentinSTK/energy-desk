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

## 2026-10-28 — M0 closed

- Public repo: https://github.com/CorentinSTK/energy-desk (MIT). First CI run: `web` green, `worker` failed
  because `astral-sh/setup-uv` publishes no floating `v10` tag; pinned to `v10.3.2`, then all green.
- `main` protected: required checks `web` and `worker`; no force-push or deletion. Work goes through PRs.
- Vercel: https://energy-desk-two.vercel.app (root `apps/web`). Live checks: `/` and `/styleguide` 200,
  404 for unknown paths, `/styleguide` noindex + disallowed in robots.txt; the 10 Playwright smoke tests
  pass against the live site (`PLAYWRIGHT_BASE_URL`).
- Not verified yet: function region `fra1`. All pages are static and served from the CDN, so no function
  runs; to verify in M1 when pages query the database (and in Vercel → Settings → Functions).

How to see it: open the live URL; the style guide is at `/styleguide` (not linked).

Next: M1 (data platform), to be planned and approved first. Needs a Supabase project in Frankfurt.

## 2026-10-28 — M1 data platform (live)

Built (PRs #2–#7):
- Schema (migration 001): `market` tables with licence, attribution, price kind and publication lag per
  series; `web` views for the site; RLS on every table; `web_reader` role that can only read `web` views.
  In-house migration runner that refuses edited or deleted migrations. ADR 0005.
- Worker: shared HTTP client (timeouts, bounded retries, 429 handling, secrets redacted), catalogue as
  YAML with licences read from each provider's terms, validation with logged rejections, COPY upserts,
  runner with lookback for revisions and ok/partial/failed status, units module (same-date FX only).
- Sources: ECB (EUR/USD, EUR/GBP), EIA (WTI, Brent, Henry Hub spot; US and Cushing crude stocks), FRED
  (IMF monthly European gas), GIE AGSI+ (EU, DE, FR, NL, IT, AT storage, fill, injection, withdrawal).
- Workflows: scheduled ingestion per publication rhythm, manual production migrations, monthly keep-alive.
- `/data`: catalogue with licence, attribution, coverage, gaps and freshness; ingestion runs; declared gaps.

Production: Supabase (Frankfurt, Postgres 17.11), 32 series, 184,573 observations, 30 MB. Live checks:
`web_reader` reads views only (writes and raw tables denied); `/data` live with real data; 18 e2e tests pass
against the live site; a manual ingest run from GitHub Actions reached Supabase (secrets work).

Found by running against real data (all fixed): AGSI `country=EU` silently empty (needs `type=eu`), now any
empty answer is a problem; ECB firewall HTML page must not read as "no data"; Easter counted as a gap;
plausible ranges too tight (669 genuine values rejected); temp-table bug on multi-batch upserts; publication
lags needed for freshness; error inside `use cache` loses its class (wrong message); errors on /data were not
logged (now logged with credentials masked).

Incident: stacked PRs — deleting a merged base branch closed PR #3 instead of retargeting it. Fixed by
restoring the branch, reopening and retargeting all PRs to `main` first. Lesson: retarget stacked PRs to
`main` before merging the first one.

Function region: Frankfurt (`fra1`), confirmed by the owner in Vercel → Settings → Functions (the response
header only shows the edge location). Not verified yet: keep-alive effect on GitHub's 60-day timer (only
observable over time).

Open decisions: EIA spot prices sourced from Refinitiv (kept, attributed; BUILD_SPEC §11); three AGSI values
rejected as implausible (AT 2011-06-16, IT 2012-04-01), kept out and visible on /data.

Known limitations: /data tables scroll horizontally on phones (cards later); AGSI backfill takes ~10–20 min
because of the API's rate limit; freshness thresholds are per frequency plus each series' publication lag.

Next: M2 (European gas & LNG), to be planned and approved first.

## 2026-10-28 — M2 European gas & LNG (live)

Built (PRs #9, #10, #11, #13, #14; #12 closed, superseded by #13):
- Migration 002: `market.futures_contracts` (unofficial raw settlements, unreadable by the site),
  `web.observations`, `web.seasonal_daily` (5 prior years per calendar day, leap years aligned, 29 Feb out).
- Sources: GIE ALSI (7 areas, 21 series; AGSI+ and ALSI share `gie.py`), ENTSOG (9 single-operator entry
  points), Yahoo TTF (front month as a single KPI, M1–M2 spread with a strict month rule; raw settlements
  kept private). All scheduled in the evening run.
- `/markets/gas` and `/markets/lng` on the market template; site header; takeaways from tested rules.

Production: migration 002 applied; backfills ENTSOG 16,148, ALSI 101,649 (18 implausible values rejected),
Yahoo 4,118 rows. Live: both pages load in ~2–3 s, no console errors, 34 e2e tests pass against the live site.
Findings on 28 Oct: EU storage 74.9% full, 14.6 pts below the 2021–2025 average and below the range; EU LNG
send-out 33% above its five-year average; TTF front month ~99.6 €/MWh with a slight prompt backwardation.

Found and fixed: ENTSOG double reporting at Emden/Dornum (declared gap); ENTSOG five-year window; ENTSOG
attribution needs the extraction date; Yahoo coarse data with range=max; M1–M2 mislabelling risk; stacked
flows collapsing on unpublished days; 120% axis; duplicate unofficial label; red arrow on 0.00; chart titles
not headings; chartInfo crash on a missing series (would have broken pages in production); unofficial label
missing in that fallback; e2e flakiness from hidden streamed copies; overlapping month labels on phones.

Decisions: EIA spot (Refinitiv) kept; ICE COT not usable (terms), positioning is a declared gap; Yahoo TTF
level only as a KPI, charts derived only.

Process note: stacked PRs now target `main` from the start (no PR closed by a deleted base branch).

Known limitations: TTF spread history starts 1 Oct 2026; flows have five years of history only; market
tables scroll horizontally on phones; the TTF spread axis shows day numbers only.

Next: M3 (European power DE/FR/GB). Needs the ENTSO-E token.

## 2026-10-29 — M3 European power (live)

Built (PRs #16 and #17 merged):
- Migrations 003 (half-hourly frequency, intraday gap thresholds of 1.5 periods) and 004 (per-series gap
  threshold: calendar-day power series report a single missing day).
- Sources, all keyless and openly licensed (ADR 0006): SMARD (DE-LU and FR day-ahead prices, German load
  and generation), RTE éCO2mix via ODRÉ (French consumption, generation, exchanges), Elexon (GB market
  index, generation by fuel, interconnectors, demand). ENTSO-E is no longer needed for DE/FR/GB.
- `worker/power.py`: daily average power over complete local delivery days only (clock changes handled).
- `worker.crosscheck power`: SMARD vs Energy-Charts, 0 differences over 193 hours (DE-LU and FR).
- `/markets/power?zone=de|fr|gb`: base price vs five-year range, intraday prices with local-time tooltips,
  DE–FR spread, load vs season, generation mix by fuel group (fixed colour per fuel), renewable share,
  FR borders and GB interconnectors; forward curve, positioning, GB auction price, GB embedded solar and
  spark/dark spreads declared as gaps. Chart footers now link the licence next to the attribution.

Local backfill (2020 onwards): SMARD 154,616 rows in 41 min, 0 rejected, 0 gaps; Elexon 167,802 rows
in 4 min (source holes: GB wind 31 missing days, MID 77 intraday gaps); ODRÉ 37,285 rows. Local database
72 MB in total. Findings for 28–29 Oct 2026: DE-LU base 315 €/MWh (above the 2021–2025 range), DE–FR
spread +48 €/MWh, German load 57.6 GW (close to average), renewables 46% of German generation.

Found and fixed: SMARD filter 254 checked as France against Energy-Charts; ODRÉ consolidated data is
30-minute and real-time 15-minute (30-minute slots); French net coal generation can be slightly negative
(idle plants' own use: range widened); Elexon MID allows 7 days per request, its stream endpoints do not;
N2EX MID rows are empty; the daily 5-day gap threshold hid missing power days (migration 004); the FR–GB
exchange sign checked against Elexon interconnectors; renewable share footer showed GW instead of %.

Decisions (approved plan): prices at source resolution, load and generation daily as average MW; Elexon
licence confirmed from its full text by the user (publication and commercial use allowed with attribution).

Known limitations: no hourly generation chart; German cross-border flows not shown yet; GB generation
excludes embedded solar; the SMARD backfill takes about 40 minutes; pages cache data for up to an hour.

Production (29–30 Oct): migrations 003 and 004 applied; backfills smard 154,616 rows (38 min), odre
37,285, elexon 167,807, all status ok. The live catalogue lists 118 series, all fresh; the Playwright
suite passes against the live site (44 tests, after making two power selectors exact: the KPI label
also opens the chart takeaway when data is present). Live KPIs on 30 Oct: DE-LU base 268.62 €/MWh
for delivery on 30 Oct, France 247.71 €/MWh, GB MID 199.60 £/MWh (28 Oct).

Found in production: the first evening cron was `partial` because SMARD hourly prices for tomorrow's
delivery hours (priced by the noon auction) were rejected as "in the future" (they were taken on the
next run, nothing was lost). Fix: a catalogue field `delivery_lead_days` (validation only) set to 1
for the day-ahead series. Unrelated: GIE ALSI sent two send-out values ~100× too high for 5 Oct; they
were rejected by the plausible range, as intended.

Next: M4 (crude and products), plan first; ENTSO-E as a cross-check when the token arrives.
