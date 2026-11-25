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

## 2026-10-30 — M4 Crude and products (built; production backfill pending)

Built (four PRs: #19 migration 005, #20 official oil sources, #21 oil futures, and the web PR):
- Migration 005: `web.seasonal_weekly`, the same ISO week of the five prior ISO years (week 53 folded into
  52, later value kept).
- EIA: 35 series added. Product spots, WPSR stocks, production (route `petroleum/sum/sndw`), trade,
  refinery runs and product supplied; STEO world balance and OPEC capacity, stored as history only (ADR 0007).
  Two crack spreads are computed from same-date spots, checked by hand on 27 Oct: USGC 3-2-1 = 50.196 and
  NYH ULSD − Brent = 73.754 $/bbl.
- CFTC COT for WTI, RBOB and NY Harbor ULSD (by contract code), raw longs and shorts, nets on the site.
- EC Weekly Oil Bulletin: petrol and diesel, with and without taxes, EU + euro area + 27 states (116 series).
- Yahoo oil futures: M1 follows CME expiry rules (CLZ26 = 20 Nov 2026, checked against Barchart and
  TradingView), with a guard turning holiday-shifted expiries into gaps. Front months for CL and BZ (KPI
  only), M1–Mn for n = 2..12 on CL and BZ, M1–M2 and M1–M6 on HO and RB.
- `/markets/crude` and `/markets/products` per template; shared weekly-seasonal, multi-series and CFTC
  cards, bar and curve charts. Header links scroll sideways on phones (the page was 96 px too wide).

Local backfill: EIA 108,557 rows, CFTC 22,323, bulletin 123,551, Yahoo 23,705; 317 series in the catalogue.
Live findings on 23–29 Oct 2026: Brent spot 123.10 $/bbl (92nd percentile of the year), Brent 19.73
$/bbl above WTI, Brent (BZ) M1–M12 +26 $/bbl (steep backwardation), US commercial crude stocks 410.6 mb
(3.8% below the 2021–2025 average for the week), OPEC spare capacity 0.02 mb/d (EIA estimate, September),
3-2-1 crack at the 88th percentile of five years, EU-average diesel 2.146 €/L (37% taxes).

Found and fixed: the old "M1 = month after the trading date" rule is wrong for oil (WTI December is M1 on 30
Oct); Yahoo appends a live quote dated like the last bar (one point per date kept); April 2020 world stock
build (−16.1 mb/d) was outside the first plausible range (widened); the STEO uses `seriesId` and `YYYY-MM`;
CFTC field names are irregular (`swap__positions_short_all`); "Cushing stocks was" in takeaways (plural);
the managed-money share chart footer said "contracts".

Known limitations: curve history starts in October 2026 (week- and month-earlier curves appear as data
accumulates); the products main chart is a time series, not a seasonal band (a daily band breaks every
weekend for trading-day series); no European refining margins or non-US stocks (declared gaps); EIA spot
prices lag by about a week. The full Playwright suite on the dev server can time out under parallel
load; the specs pass when re-run and CI uses the production build.

Next: merge the M4 PRs in order (#18, #19, #20, #21, web), run DB migrate (005), backfill `eia`, `cftc`,
`ec_wob` and `yahoo`, check the live pages; then M5 (home).

## 2026-10-30 — M5 Home page (live)

M4 in production: backfills ok (EIA 108,541 rows, CFTC 22,323, bulletin 123,551, Yahoo 23,418; 317 series).
Migration 005 was not yet applied in production at the time (DB migrate pending) and #22 needed a
rebase (session log conflict only).

Built (PRs #23 coverage, #24 migration 006, #25 home page):
- AGSI+ storage for all 18 EU countries with data; ALSI data per LNG terminal (29 active EU terminals,
  generated from the live listing; Stade and Hamina never published and are left out). The 5 Oct send-out
  anomaly is Ravenna's 100,000 GWh/d, still rejected.
- `web.series_snapshot`: latest value, move z-score, 5-year percentile and seasonal gap per series in one
  query (0.3 s for 80 series on the full local database).
- Home page: server-rendered SVG map (Europe: storage / power / diesel layers, terminals, entry points,
  hubs; world: benchmarks and chokepoints), three unit-free measures, side panel from `?focus=`, the map as
  a table, a labelled benchmark strip and rule-based "Today in energy" (ADR 0008).

Found and fixed: conic parallels are arcs, so a frame from corners cut off Malta and Sicily; world-atlas
territories without an ISO code duplicated React keys; marker ids with underscores were refused by the
URL check; psql prints timings with a French decimal comma (0.3 s, not 314 s).

Known limitations: markers are small touch targets on phones (the table is the alternative); marker
positions are approximate (up to ~50 km); series on the map have different dates (shown in the panel).

Production (30 Oct): #22–#25 merged, migrations 005 and 006 applied, `gie_agsi` and `gie_alsi`
backfilled (58 terminal series with data). The live home page colours all 18 storage countries and the
terminals; Playwright passes against the live site (70 tests, after raising the expectation timeout to
15 s for first renders, #27). Live finding: Slovakia is the storage country furthest from normal (54.0%
full on 28 Oct, 32.2 pts below its 2021–2025 average); EU storage 74.9%, 14.8 pts below.

The full local backfill also showed 492 storage filling levels above 105% rejected: real values above
declared working volume (Portugal 2019–2024, Belgium autumn 2022, Denmark 31 Oct 2016), so the bound
becomes 130% (#26). The 31 ALSI rejections are source errors (placeholder 100,000 at Revythoussa, Rovigo
and Ravenna, small negative values) and stay rejected.

Next: merge #26 and #27, re-run the `gie_agsi` backfill; then M6 (forecast registry), plan first.

## 2026-10-30 — M6 Forecast registry (built; production rollout pending)

Built (PRs: #28 registry, #29 Open-Meteo, engine, pages):
- Migration 007: forecasts stored at issue time with baselines and inputs; live forecasts cannot be
  changed or deleted, nor issued once their outcome is published (triggers); scores computed in views.
  Migration 008: `weather` category.
- Open-Meteo temperatures for eight French cities from 2015; ODRÉ history extended to 2015.
- `worker/forecast`: models only see the history cut at the issue date's publications; walk-forward
  backtests; empirical 90% intervals from earlier errors only; CLI and a daily Forecast workflow.
- Models and local backtests (to 30 Oct 2026): EU storage in 30 days (MAE 1.8 pts, skill +77% vs naive,
  +19% vs seasonal, coverage 89%); France demand 1–7 days (day 1: MAE 1.6 GW, +54% / +62%, coverage 92%,
  with observed weather); US crude stocks next report (MAE 4.2 mb, +2% / +1%: no clear edge).
- `/forecasts` and `/forecasts/[id]`; "related forecast" links on the gas, power and crude pages.

Found and fixed: "target after issue time" was the wrong guard (Tuesday's forecast of last Friday's
stocks), replaced by "outcome not yet published"; a weekday/ISO-day mix-up in the crude model's seasonal
weeks (caught by a synthetic-data test); French demand horizons start tomorrow; a "beats both baselines"
badge on +2%/+1% skill, replaced by a 5% clear-edge rule; unknown model ids now return a real 404.

Known limitations: backtests use revised data and, for French demand, observed weather (optimistic); the
crude model has no useful skill (shown as such); live scores need about a month (daily models) or seven
months (weekly) before a verdict; no load value on 25 Oct 2026 (clock change) in the source data.

Next: merge #28, #29, the engine and pages PRs; DB migrate (007, 008); backfill `open_meteo` and `odre`;
run the Forecast workflow in backtest mode for all models, then let the daily issue run; then M7 (Lab).

### 2026-10-31 — M6 in production

- Migrations 007 and 008 applied; `open_meteo` and `odre` (from 2015, after the "ND" fix in #32)
  backfilled: ODRÉ 27,330 rows added, status ok.
- Production backtests (2019 → 31 Oct 2026):
  - EU storage: MAE 1.84 pts, +77% vs naive / +19% vs seasonal, coverage 89%.
  - France demand: 19,985 forecasts, MAE 1.75 GW, +49% / +56%, coverage 91%.
  - US crude: −3.6% / −0.9%, so it does not beat its baselines over this period. The site says so.
- First live issue: the 22:30 UTC schedule started 3 h late (01:44 UTC on 31 Oct). Its 8 forecasts were
  stamped 21:00 UTC on 31 Oct, a fixed time, instead of the real time. They also have no interval,
  because they were issued before the production backtest existed. Live forecasts are immutable, so
  these rows stay as stored and this note records the anomaly. Fixed for later issues: the real time of
  issue is stored, there is one issue per model and day, and `--date` is only allowed for dry runs.

## 2026-10-31 — M7 Lab v1 (built; awaiting merge)

Built (PRs #34 engine, pages):
- `lib/lab`: indicators without look-ahead (weekly stocks used from publication), a safe typed rule
  grammar read from the URL, backtests executed the day after the signal with costs, stops, targets and a
  tuning/control split, and a seeded block-bootstrap simulator by regime with exits at observed levels.
- `/lab`, `/lab/backtest` (5 presets, GET form, stats per period, cost sensitivity, P&L and drawdown,
  signal and thresholds, trades) and `/lab/simulator` (series links, levels form, fill and
  target/stop probabilities, P&L histogram). Footers name the official sources. Lab links on the power,
  crude and products pages.
- Brent–WTI preset, locally: 62 trades in 26.8 years. Control period (after Sep 2018): +54.9 $/bbl,
  75% hit rate, Sharpe 0.43, max drawdown −22.6 $/bbl. The first trade was checked by hand against the
  database.

Found and fixed: the simulator first exited stops and targets at the exact level (it now uses the
observed level, including gaps); an emptied form field brought back the preset's limit; changing the
series in the simulator form would have kept another series' levels (series are now links); chart
footers said "Energy Desk Lab" instead of the official source and its attribution.

Known limitations: spot-spread P&L is a signal measure, not an executable strategy; the bootstrap
replays the past; futures-based presets wait for history.

Next: merge #34 and the pages PR; then M8 (polish and launch).

## 2026-10-31 — M8 Polish and launch (live); M0–M8 complete

Built and merged:
- PR #36, `/methodology`:
  - sections on principles, seasonal norms, derived series, freshness, home, forecasts, the Lab,
    data licensing and known limits;
  - the sources table is generated from the catalogue.
- PR #37, monitoring without third-party accounts:
  - `onRequestError` writes JSON logs;
  - `worker.health` runs every 6 h in `health.yml` with the read-only role (ADR 0011);
  - first run green: 10 pages and the data, "All good".
- PR #38, Lighthouse and mobile:
  - ECharts is loaded on demand and charts are created near the viewport;
  - static market headers;
  - lighter `/data` markup;
  - accessibility fixes;
  - a "no horizontal scroll at 390 px" e2e test on every page.
- PR #39, `/about` and the rest:
  - `/about` with a one-line author note (agreed with the user);
  - a site-wide footer, `sitemap.xml`, and an Open Graph image generated at build time;
  - fixed `/methodology` scrolling sideways on phones (found by the new mobile test);
  - e2e tests are now robust to the hidden page copy that Next keeps (React Activity).
- PR #35, Lab pages: merged after resolving a session-log conflict.
- PR #40, cache keys: lookback windows (`daysAgo`) are rounded to midnight UTC.
  - The timestamp to the millisecond was a cache key, so every request missed `use cache`.
  - Locally, with a warm cache, market pages now stream in about 70 ms instead of 1.4–2.9 s.
- This PR: README with screenshots (`npm run screenshots`), spec statuses, this entry.

Measured on the live site (Lighthouse mobile, 31 Oct):
- accessibility is 100 on all 12 pages;
- performance:
  - 98–100: home, gas, power, products, forecasts, Lab, methodology, about;
  - 94: Lab backtest;
  - 90–95: crude;
  - 86–89: LNG;
  - 88–89: `/data`.
- Playwright on the live site: 126/126.

Known limitations:
- On Vercel, the dynamic part of every page still streams after about 3 s. This includes
  `/methodology`, which locally takes 72 ms with a warm cache. So it is not the database and not
  only the cache key. Likely suspects are function cold starts or a `use cache` store that is not
  reused across invocations. Diagnosing it needs the Vercel function logs.
- `/data` renders 318 rows in one table; pagination or grouping would lift it above 90.
- The ENTSO-E token is still pending; ENTSO-E is to be added as a cross-check source when it arrives.

Recap M0–M8 (28–31 Oct 2026):
- M0: scaffold, design system, CI and deploy.
- M1: data platform and `/data`.
- M2: European gas and LNG.
- M3: power in DE, FR and GB.
- M4: crude and products.
- M5: home map and Today in energy.
- M6: forecast registry with three models and walk-forward backtests.
- M7: Lab with the backtester and the simulator.
- M8: methodology, about, monitoring, performance, mobile and README.

Next:
- diagnose the 3 s stream on Vercel;
- the ENTSO-E cross-check;
- then phase F (freight) or P2, as the user prefers.

## 2026-11-20 — The 3 s data delay on the live site: found and fixed

Finding the cause:
- PR #42 added timing logs. The Vercel CLI was linked (read-only use) to read them.
- The function runs in `fra1` and stays warm between visits (instance age 0, 8, then 15 s), so it
  was not a cold start or the region.
- Series queries took 2–50 ms. The page context took about 2.5 s on every visit:
  `web.series_catalog` scanned every observation with a window function on each read (4.9–12 s
  from Singapore).

Fixed:
- PR #43, migration 009 and ADR 0012: coverage now lives in the materialized view
  `market.series_coverage`. The worker refreshes it after each run, and a failed refresh marks the
  run partial.
  - A test checks the figures against the old live calculation.
  - DB migrate and one Ingest (`gie_agsi`, ok) were run in production.
- PR #44: Next.js 16.4.3 → 16.4.6 for GHSA-mfr8-8qww-v76h and GHSA-vc7v-qv4w-wrv8 (moderate,
  root-param cache leaks; the site has no root params). The production audit is clean. More e2e
  text locators are now visible-only, because of the hidden page copy.
- PR #45: logs are reduced to `slow_data` lines (loads over 500 ms).

Measured live, warm, from Singapore:
- the page context: 2,500 ms → 29 ms;
- LNG: 3.1 s → 0.8 s;
- gas: 3.0 s → 0.7 s;
- power: 3.2 s → 0.6 s;
- methodology: 3.2 s → 0.4 s;
- home: 4.0 s → about 2 s (`web.series_snapshot` about 500 ms, plus the map render).

Still open:
- `use cache` rarely hits on Vercel. Cheap now, but not understood.
- Home page snapshot query cost.
- `/data` Lighthouse 88–89.
- The ENTSO-E token.
- The Vercel CLI re-adds `.env*` to `.gitignore` when it renews its token. Revert it each time,
  because it would hide `.env.example` files.

## 2026-11-20 — Home page snapshots precomputed; /data paginated

- PR #46, migration 010:
  - the 006 snapshot calculation is moved unchanged to `market.compute_series_snapshot`, which the site
    cannot execute;
  - its result for every series is stored in `market.series_snapshots`;
  - `web.series_snapshot(codes)` reads the stored rows;
  - the worker's `refresh_summaries` refreshes the coverage, then the snapshots.
  - Tests: stored rows equal the calculation; rows change only on refresh; `web_reader` can read them
    but not compute.
  - Production: DB migrate, then Ingest `gie_agsi` ok at 14:34 UTC.
  - No `slow_data` line since then. Home page from Singapore: median about 1.05 s over 8 visits
    (0.5–2.9 s); it was about 2 s after #43 and about 4 s before. The rest is the map render, the
    network and occasional new instances.
- PR #47, `/data` pagination:
  - 50 series per page;
  - the page number lives in the URL with the filters, and changing a filter goes back to page 1;
  - a page past the end shows the last page;
  - `parseFilters` bounds the page (1–1000, digits only);
  - `paginate` and the links are unit-tested;
  - e2e: a pagination test, and the catalogue test no longer depends on which page a code lands on.
  - The HTML goes from 1.66 MB to 430 KB (409 active series, 9 pages). Lighthouse on a local
    production build: 100/100, 3 runs out of 3 (TBT about 50 ms, from about 400).

## 2026-11-21 — Phase F, freight and shipping (built)

- **Sources checked live (20 Nov).** IMF PortWatch publishes daily transits for 28 chokepoints since
  2019, about five days behind, plus a database of disruption events.
  - Licence: IMF terms. Publication with attribution is allowed; automated access needs
    permission.
  - The owner decided to use the data while the permission request is pending (ADR 0013).
  - PortWatch documents HORMUZ-26 (from 1 Mar 2026, ongoing, RED): Hormuz tanker transits are
    about 0.4 a day against a 51 a day norm. The Cape of Good Hope is +37%.
- **PR #48 (step 1):**
  - migration 011: the `freight` category and `market.shipping_events`;
  - `portwatch` source and catalogue: 8 chokepoints × 3 series.
  - Dry run spot-checked against the API.
- **PR #49 (step 2):** routes generated with searoute. The passage check caught a mislabel: without
  Panama, the shortest US → Japan route runs through Suez, not around the Cape.
- **PR #50:** PortWatch scheduled with the 14:15 UTC ingest group.
- **This PR (step 3):**
  - migration 012: short event codes, used as chart labels;
  - `/markets/freight`:
    - KPIs: 7-day mean against the 5-year norm;
    - main chart: weekly 7-day means over 2 years, with event lines;
    - tabs: chokepoints (seasonal chart and table), routes, gaps;
  - home chokepoint markers now carry tanker transits;
  - links from the crude, products and LNG pages;
  - methodology section, declared gaps (freight rates, bunkers, vessel-level tracking);
  - nav, sitemap, Health and the mobile e2e test.
- **Measured locally, on a local DB with the PortWatch history:**
  - Lighthouse: performance 87–94 (high run-to-run variance), accessibility 100;
  - HTML 150 KB, after moving the two-year chart to weekly points and rounding for transport;
  - before that change: 8 daily lines, a 500 ms long task in ECharts.
- **Pending:**
  - production: DB migrate (011, 012), then a PortWatch backfill;
  - the IMF's answer;
  - Lighthouse on the live page.

## 2026-11-23 — Phase F in production; stuck pages fixed

- Production:
  - #48–#51 merged;
  - DB migrate applied 011 and 012. A first Ingest run before the migration failed harmlessly on the
    `freight` category check;
  - PortWatch backfill ok: 69,027 rows, 24 series up to 15 Nov, 3 events (HORMUZ-26, RED SEA
    TENSIONS, RESTRICTIONS PANAMA CANAL).
- After the rollout, Health failed with ReadTimeout on the gas and freight pages. Vercel logs showed
  `Task timed out after 300 seconds` on most pages: the content streamed in under a second, but the
  response never closed.
  - #52: every data load is limited to 10 s. On a timeout, the card shows its error state, the page
    completes, the pool is reset and `query_timeout` is logged. Connections are recycled every
    5 minutes.
  - #53: on fresh local servers against the production DB, one load always hung. A trace showed the
    query started and never finished.
    - Ruled out: the query itself (0.3 ms), its plan, and postgres.js on its own (33 parallel
      queries are fine). Disabling pipelining changed nothing.
    - The block always hit the freight tab's first new query.
    - With a pool of 10 instead of 3, there were no timeouts on fresh servers. The chokepoint table
      now loads 24 series in one query.
- Checked live after #53:
  - all pages finish in 0.9–1.9 s, including freight on its first visit;
  - Health: All good (11 pages and the data).
- Still open: one `query_timeout` in about 20 minutes of traffic, on the chokepoint table. The cause
  is unknown; a connection may stall while it opens. It is contained (10 s, error card, logged).
  - Possible next step if it recurs: retry a timed-out query once on a fresh connection, without
    ending the pool. A pool reset also cut sibling queries, which ruled out the first attempt.

## 2026-11-25 — Phase F closed: live checks and a cache-level timeout fix

- #54 merged (session log for phase F).
- Lighthouse on the live freight page, 3 runs:
  - performance 89–92, accessibility 100;
  - LCP 2.4 s, TBT 270–380 ms, CLS 0.
- Health and Ingest green on every run since #53.
- Found live: the chokepoint table failed on about one request in two.
  - Symptoms: the response took 10.3 s, and every cell showed "—" with no error state.
  - Only the table was affected (`getPointsMany`). Other cards, other strait tabs and other pages
    were fine. It did not reproduce locally.
  - Cause: Next's per-instance dedup of `use cache` invocations. A generation that never finishes
    blocks every later read of its key on that instance. The 10 s limit sat outside the cache and
    could not end it. Why the query hung is not established (Vercel logs not read).
- Fix (ADR 0014):
  - each SQL query is limited to 4 s inside its cached function, with one retry on a fresh pool;
  - pool resets now leave 5 s for queries in flight;
  - the table shows the error state on failure.
- Checked with a local proxy that freezes the DB: error card during the freeze, normal load right
  after.
- Merged #55; then live: no more "—" or error cards in 40 visits, but one freight visit in two took
  4.5 s.
- #56: one `db_query` log line per SQL query that runs (each line is a `use cache` miss), with pool
  age and idle time.
  - The logs showed about 23 SQL queries per visit: the in-memory cache kept almost nothing on
    Vercel.
  - Next 16 documents this for serverless: entries "typically don't persist across requests".
  - The slow visits did not run `getPointsMany` and waited on a cache entry instead.
- #57 (ADR 0015): the 11 cached data functions use `'use cache: remote'`, stored in Vercel Runtime
  Cache.
  - Hobby allows 1M reads and 200K writes a month. When the quota runs out the cache pauses: no
    charge, and the site falls back to the database.
  - Measured live after the deploy: 0 SQL queries on repeat visits, versus about 23 before.
  - Freight 0.4–1.2 s, with no 4.5 s visits; gas 0.3 s; home 0.6 s; no error cards.
  - The 4 s waits went away with the remote cache. Their exact mechanism (a pending in-memory entry)
    was not proven.
- Closes ADR 0012's open item "`use cache` rarely hits on Vercel".
- Playwright on the live site after #57: 137/138 on the first clean run. The desktop Lab stop-side
  test failed once, then passed 3/3 on repeat. An earlier run had been invalidated by the machine
  sleeping mid-run (4.4 h, `page.goto` timeouts).

## 2026-11-25 — Phase 2 (P2a–P2e) in production

- P2a, LPG (#59, #60):
  - `/markets/lpg` shows Mont Belvieu propane, propane as % of WTI (derived by the worker), US
    propane stocks against their 5-year range, demand and exports (EIA, verified live);
  - positioning from the CFTC (NYMEX propane 06665O), the same contract units since 2009;
  - declared gaps: European and Asian LPG prices, European stocks, propane futures.
- P2b, power zones (#60):
  - day-ahead prices for NL, BE, AT, CH, IT-North and PL from SMARD;
  - each filter ID was matched to its zone against Energy-Charts (48 h each, max difference
    0.01 €/MWh);
  - the power page compares eight zones on one delivery day. SMARD skipped NL on 20 Nov, and the
    page shows that day as not published;
  - load and generation for these zones are a declared gap (ENTSO-E token);
  - the Ingest workflow now takes a validated `series` list for targeted backfills.
- P2c, United States (#61):
  - "United States" tabs on gas (storage against its 5-year range, Henry Hub, monthly LNG exports)
    and on power (EIA-930 Lower 48 daily demand and the six largest sources);
  - the EIA source accepts facet refs;
  - `incomplete_recent_days` drops days still being filled in: EIA-930's latest day was partial
    when checked.
- P2d, day-ahead price forecasts for DE-LU and FR (#62, #63, ADR 0016):
  - issued at 22:30 UTC for the day after tomorrow;
  - a regression on the latest known price, German wind and sun (new `open_meteo_de`, 12 series),
    the weekday, and for France heating degree-days and holidays;
  - production backtest 2020–2026: skill vs naive 17 % (DE-LU) and 10 % (FR), vs seasonal 42 % and
    44 %;
  - #63 fixed a bug that would have broken tonight's `--model all` run for every model. A test now
    builds every registered model.
- P2e, carbon:
  - EEX terms forbid republishing auction results or CoT without written approval; public display
    needs a paid Media Usage licence;
  - EUA and clean spreads stay declared gaps.
- Not done: Japan power (JEPX terms not checked), EEX MiFID position reports (EEX terms).
- Live after the deploys: the LPG, power, US-tab and forecast pages return 200 with no error cards.

## 2026-11-25 — Visual pass, step 1: header and home page

- Header: brand mark, sticky translucent bar, markets and tools separated, current section highlighted.
- Home: larger title block; benchmark strip as one ribbon (commodity dot, monospaced figures, change
  pill, short dates, freshness count); map controls as segmented controls inside the map card; legend
  as a colour bar under the map; side panel ranks the most unusual countries when nothing is selected;
  "Today in energy" cards tagged by market.
- No change to charts, data or colours. Checked: lint, typecheck, format, 303 unit tests, home, smoke
  and mobile e2e (56), screenshots in both themes and at 390 px.
- Step 2, same day: "CS" monogram in the header and as the browser icon (app/icon.svg replaces the
  default favicon); side-sheet menu below 1024 px instead of sideways-scrolling links; market headers
  with a commodity pill; KPI cards with monospaced values, change pills and a ruled context block;
  page titles one size up. Full e2e suite (154) passed locally.
