# BUILD_SPEC — Energy Desk (working name)

This file is the single source of truth for what we are building, why, and in what order.
Read it fully before planning any work. When a decision changes, update this file in the same commit.

---

## 1. Vision

A web platform that tracks the world's main energy markets — crude oil, refined products, natural gas,
LNG, LPG and power — using free public data, and lets the user:

1. **See** where each market stands today, in under a minute, from a single home page.
2. **Understand** why: stocks against seasonal norms, curve structure, flows, positioning.
3. **Test** ideas on history: rule backtests and Monte-Carlo trade simulations.
4. **Forecast** a small set of variables, and **score every forecast against what actually happened**,
   publicly and permanently.

### Audience

- **Primary:** an energy trader or analyst (e.g. a crude oil desk) opening the site between two calls.
  They know the market better than we do. Every number must be correct, sourced, and in the unit they expect.
- **Secondary:** a recruiter or hiring manager judging the author's skills. They will spend 2–5 minutes.
  The home page and one market page must impress in that time.

### What "good" looks like

- Simpler to read than a typical data dashboard, not more complex. Less information on screen, better chosen.
- Every chart answers one question, stated in its title, with a one-sentence plain-English takeaway.
- Honest about data gaps: a missing market is shown as missing, never estimated silently.
- Fast: pages load in under 2 seconds; charts stay smooth with 10+ years of daily data.
- The author can explain every screen, model and number. Favour clarity over cleverness.

### Non-goals

- No paid or licensed data (Bloomberg, Platts, Argus, ICE settlements, broker sheets). Never commit such data.
- No trading recommendations or "signals" presented as advice. The Lab is a research tool.
- No user accounts in phase 1. The site is public and read-only.

---

## 2. Product principles (UX)

1. **One question per screen.** Each page and each card has a single job, stated in its title
   (e.g. "Are US crude stocks tight for the season?").
2. **Headline first, detail on demand.** Top of page: 3–5 KPI cards and one main chart.
   Everything else sits below, in tabs, accordions or drawers. Never show 12 charts at once.
3. **A takeaway under every chart.** One generated sentence in plain English, e.g.
   "Cushing stocks are 18% below their 5-year average for this week, the lowest since 2022."
   Takeaways are computed from data with explicit rules, never free-form text.
4. **Context on every number.** A value is always shown with its change and its comparison
   (vs last week, vs 5-year seasonal average, percentile in history).
5. **Source and freshness everywhere.** Under every chart: source, unit, last observation date,
   and a freshness badge (fresh / delayed / stale).
6. **Consistent visual language.** One colour per commodity across the whole site; one chart grammar;
   identical layout for every market page.
7. **Shareable state.** Filters, date ranges and Lab parameters live in the URL.
8. **Graceful states.** Every component has loading (skeleton), empty, error and stale states.
9. **Mobile works.** Read-only views must be usable on a phone; the Lab can be desktop-first.
10. **Explain the method.** Each chart has an "i" popover: what it shows, how it is computed, caveats.

---

## 3. Information architecture

**Focus: Europe.** Gas, LNG and power are covered for Europe; crude oil and products are covered as
global markets (they are priced globally). Non-European gas and power markets are phase 2.

```
/                         Home — Europe map (with a world view for oil) + "today in energy" summary
/markets/gas              European natural gas (storage by country, flows, hubs)
/markets/lng              European LNG (terminal inventory and send-out)
/markets/power            Power — DE, FR, GB (zone selector in the URL: ?zone=de|fr|gb)
/markets/crude            Crude oil (global view)
/markets/products         Refined products (gasoline, diesel/gasoil, jet, cracks)
/markets/lpg              LPG (propane)                       [phase 2]
/markets/freight          Freight & shipping (tankers, LNG carriers, chokepoints)   [later phase]
/forecasts                Forecast registry and live scoreboard
/forecasts/[id]           One forecast model: method, history, accuracy vs realised
/lab                      Research lab: rule backtests and trade simulator
/data                     Data catalogue: every series, source, unit, frequency, licence, freshness, gaps
/methodology              How everything is computed; known limitations; data licensing
/about                    About the project and the author
```

### Home page

- A map rendered on the server as plain SVG (d3-geo + world-atlas, no tile provider; ADR 0008), two views:
  - **Europe (default):** countries coloured by a **layer**: gas storage (AGSI+, 18 EU countries),
    power prices (bidding zones DE-LU, FR, GB) or the diesel pump price (EC Weekly Oil Bulletin, 27
    states). Markers: 29 LNG terminals (GIE ALSI, per terminal), 9 pipeline entry points (ENTSOG) and
    the gas hubs (TTF with unofficial futures data; NBP, THE, PEG drawn as "no data").
  - **World:** oil and gas benchmarks (Brent/North Sea, WTI/Cushing, Henry Hub) and chokepoints (Hormuz,
    Bab el-Mandeb, Suez, Malacca, Panama; "no data" until the freight phase).
  - A **measure** chosen by the user, unit-free so different series share one scale (`web.series_snapshot`,
    migration 006): *vs 5-year average* (% from the mean of the same day / ISO week; the default),
    *latest move* (z-score of the latest change against the past year's changes) or *5-year
    percentile*. A point without data is shown as "no data", never estimated.
  - Marker positions: Natural Earth ports and towns (public domain), approximate, drawing only.
- Click a country or marker → side panel (state in the URL, `?focus=`) with its latest values, date,
  percentile and seasonal gap, and a link to the market page. The same data is available as a table.
- "Today in energy": up to 6 sentences from fixed rules (EU storage vs norm, moves of 2σ or more,
  5-year extremes beyond the 95th/5th percentile, the storage country furthest from its norm).
- A compact strip of benchmark prices with the change from the previous value, each labelled with its
  price type and source.

### Market page template (identical structure for every market)

1. **Header:** market name, 3–5 KPI cards (price, change, curve structure, stocks vs seasonal, …).
2. **Main chart:** the one chart that best summarises the market now.
3. **Tabs:**
   - *Prices & curve* — benchmarks, forward curve today vs 1 week / 1 month ago, time spreads.
   - *Balance & stocks* — stocks vs 5-year seasonal range, supply/demand components where available.
   - *Flows* — imports, exports, pipeline or terminal flows where available.
   - *Positioning* — CFTC COT where it covers the market (WTI, Henry Hub). ICE Futures Europe COT (Brent,
     gasoil, TTF) cannot be republished under ICE's terms (checked 2026-10-28), so European positioning is a
     declared data gap unless ICE grants written permission.
   - *Data gaps* — what is not covered and why (including licensing reasons).
4. **Related:** links to relevant forecasts and Lab presets.

A tab with no data for a market (e.g. a forward curve for power: exchange futures are licensed) is kept
and shows a `DataGapNotice` explaining why, so every market page keeps the same structure.

### Methodology page

Includes a **Data licensing** section: exchange prices (CME, ICE, EEX, EPEX) are licensed and are not
redistributed here; what we show instead (official spot and fundamentals, derived indicators from
unofficial futures data); and the licence and attribution of every source.

---

## 4. Data sources (free)

Always verify an endpoint live before building on it; APIs change. Record every series in the
`series` catalogue table with its source, unit, frequency, **licence and required attribution**.
Respect each provider's terms of use.

The "Licence" column is what we expect. **It is confirmed from the provider's own terms when the source is
integrated**, and recorded in `series.license` / `series.attribution` (see §5). Items marked "verify" are
not yet confirmed. EIA v2 series are addressed by route + facets (e.g. `petroleum/pri/spt`, `series=RWTC`);
the v1-style IDs below are kept as human-readable references.

**Phase 1**

| Market | Data | Source | Access | Frequency | Licence (expected) |
|---|---|---|---|---|---|
| Gas | EU gas storage by country and facility | GIE AGSI+ (`agsi.gie.eu/api`) | free key (`x-key` header) | daily | Free reuse, "GIE AGSI" credit mandatory (confirmed 2026-10-28). No GB data since Brexit. |
| Gas | Pipeline flows at 9 EU entry points, one series per point and operator (never summed across operators) | ENTSOG Transparency (`transparency.entsog.eu/api/v1`, `operationalData` per point; country aggregation returns nothing; five years of history only) | none | daily | ENTSOG TP terms art. 5: use in good faith, quote "ENTSOG TP [DD-MM-YYYY] https://transparency.entsog.eu/" (confirmed 2026-10-28). Norway → Germany (Emden, Dornum) is reported by several operators with overlapping values: declared gap. |
| Gas | Official monthly benchmark (Europe gas) | FRED `PNGASEUUSDM` (IMF); World Bank Pink Sheet later | free key | monthly | IMF data: free reuse with attribution, no alteration (confirmed 2026-10-28) |
| Gas | Henry Hub spot (context only) | EIA | free key | daily | US public domain |
| LNG | EU LNG terminal inventory and send-out | GIE ALSI (`alsi.gie.eu/api`, same key as AGSI+) | free key | daily | Same GIE terms as AGSI+: free reuse, credit mandatory. No GB data since Brexit. |
| Power | DE-LU and FR day-ahead prices (filters 4169, 254), German load and generation by fuel | SMARD (Bundesnetzagentur, `smard.de/app/chart_data`) | none | hourly | CC BY 4.0, "Bundesnetzagentur \| SMARD.de" (confirmed 2026-10-29, smard.de/en/datennutzung). FR price matches Energy-Charts exactly. |
| Power | FR consumption, generation by fuel, commercial exchanges per border | ODRÉ / éCO2mix (RTE, Opendatasoft API: `eco2mix-national-cons-def` + `-tr`) | none | 30-min / 15-min | Licence Ouverte v2.0 (confirmed 2026-10-29 from dataset metadata) |
| Power | GB market index price (MID, APX provider), generation by fuel and interconnectors (FUELHH), national demand (INDO) | Elexon Insights (`data.elexon.co.uk/bmrs/api/v1`) | none | half-hourly | BMRS data licence: free reuse including publication and commercial use; "Contains BMRS data © Elexon Limited copyright and database right <year>" plus a link to the licence where possible; no implied endorsement (full text confirmed 2026-10-29) |
| Power | Cross-check of SMARD prices (`worker.crosscheck power`, not stored) | Energy-Charts (Fraunhofer ISE, `api.energy-charts.info`) | none | 15-min | per dataset in `license_info` (DE-LU and FR prices: CC BY 4.0 from SMARD) |
| Power | Cross-check, other zones (phase 2) | ENTSO-E Transparency (`web-api.tp.entsoe.eu/api`) | free token by email request | hourly | ENTSO-E terms — verify when the token arrives. Not needed for DE, FR, GB (ADR 0006). |
| Crude | WTI, Brent spot (`RWTC`, `RBRTE`) | EIA API v2 | free key | daily (published weekly) | EIA public domain; EIA states the spot prices come from Refinitiv (LSEG) — see §11 |
| Crude | US stocks: commercial (`WCESTUS1`), Cushing (`W_EPC0_SAX_YCUOK_MBBL`), SPR (`WCSSTUS1`), total (`WTTSTUS1`) | EIA WPSR (`petroleum/stoc/wstk`) | free key | weekly | US public domain |
| Crude | US production (`WCRFPUS2`, route `petroleum/sum/sndw`), imports/exports/net (`WCRIMUS2`, `WCREXUS2`, `WCRNTUS2`), refinery utilisation and runs (`WPULEUS3`, `WCRRIUS2`) | EIA WPSR | free key | weekly | US public domain |
| Crude | World production, consumption, stock change; OPEC production, capacity, spare capacity (`PAPR_WORLD`, `PATC_WORLD`, `T3_STCHANGE_WORLD`, `COPR_OPEC`, `COPC_OPEC`, `COPS_OPEC`) | EIA STEO (`steo`, facet `seriesId`) | free key | monthly | US public domain. **History only**: months before the current one; forecast months are not stored (ADR 0007) |
| Products | Gasoline (NYH, USGC, LA RBOB), ULSD (NYH, USGC, LA CARB), USGC jet, NYH heating oil spot | EIA (`petroleum/pri/spt`) | free key | daily (published weekly) | as WTI/Brent spot |
| Products | Crack spreads: USGC 3-2-1 vs WTI, NYH ULSD vs Brent | computed by the worker from same-date EIA spots (`worker/oil.py`) | — | daily | as EIA spot |
| Products | US gasoline, distillate, jet stocks (`WGTSTUS1`, `WDISTUS1`, `WKJSTUS1`), product supplied (`WGFUPUS2`, `WDIUPUS2`, `WKJUPUS2`, `WRPUPUS2`), exports (`WDIEXUS2`, `W_EPM0F_EEX_NUS-Z00_MBBLD`, `WKJEXUS2`) | EIA WPSR | free key | weekly | US public domain |
| Products | EU consumer fuel prices (Euro-super 95, diesel) with and without taxes, EU, euro area and 27 member states | European Commission Weekly Oil Bulletin, price history workbook | none | weekly | CC BY 4.0 under the Commission legal notice (Decision 2011/833/EU), credit and indicate changes (confirmed 2026-10-30) |
| All | Positioning: ICE Futures Europe COT (Brent, gasoil, TTF) | ICE public COT reports | none | weekly | **Not usable**: ICE terms allow personal, non-commercial use only and forbid republication without written permission (checked 2026-10-28). Declared gap. |
| All | Positioning: CFTC COT disaggregated, futures only (NYMEX WTI `067651`, RBOB `111659`, NY Harbor ULSD `022651`; Socrata dataset `72hh-3qpy`) | CFTC Public Reporting API (Socrata) | none | weekly | Public domain, acknowledge the CFTC (cftc.gov/WebPolicy, confirmed 2026-10-30). Raw longs and shorts stored; nets computed on the site |
| All | FX for unit conversion (EUR/USD, EUR/GBP) | ECB Data Portal (`data-api.ecb.europa.eu`) | none | daily (TARGET days) | Free reuse, quote "Source: ECB statistics.", do not modify (confirmed 2026-10-28) |
| All | Macro and volatility: USD index, rates, OVX | FRED | free key | daily | per series; some are copyrighted (e.g. CBOE OVX) — verify each |
| All | Weather for demand models (HDD/CDD): daily mean temperature of the eight largest cities of metropolitan France | Open-Meteo (archive for history from 2015; forecast API read at issue time, never stored as observations) | none | daily | CC BY 4.0, "Weather data by Open-Meteo.com"; ERA5 from Copernicus C3S; free API for non-commercial use (confirmed 2026-10-30) |
| All | French public holidays (demand model) | calendrier.api.gouv.fr | none | yearly | Licence Ouverte (Etalab) |
| Futures | Front month and individual contracts where available (see note) | Yahoo Finance via `yfinance` | unofficial | daily, delayed | **not licensed for redistribution** — see ADR 0003 |

Futures note (checked 2026-10-28): on Yahoo, `BZ=F` and `TTF=F` are **NYMEX** contracts (a financially
settled Brent look-alike and the NYMEX Dutch TTF contract), not ICE Brent or ICE Endex TTF; `CL`, `HO`, `RB`,
`NG` are NYMEX. ICE gasoil and NBP are not available on Yahoo. Labels must name the actual contract.
For TTF only the first two monthly contracts are listed (e.g. TTFZ26.NYM, TTFF27.NYM): enough for the
front-month spread, not for a full curve; spread history accumulates from the first ingestion.
The oil contracts (CL, BZ, HO, RB) are listed more than a year ahead (checked 2026-10-30), so curve
structure M1 − Mn is shown as spreads; M1 follows each contract's exchange expiry rule (ADR 0007).

**Freight & shipping (later phase).** Freight links the regional markets: it sets arbitrage windows
(e.g. US Gulf → Europe crude, US LNG → Europe vs Asia) and reacts first to chokepoint disruptions. Scope to
study when the phase starts, each source to be verified live and for licence:
- Chokepoint and port activity from AIS-derived open data (candidate: IMF PortWatch, daily transits through
  Hormuz, Bab el-Mandeb, Suez, Panama…).
- Voyage distances and times for benchmark tanker and LNG routes (e.g. the VLCC MEG → China route),
  recomputed from port coordinates with an open sea-routing method and stated assumptions (speed, sea
  margin, port time), never copied from licensed route tables.
- Freight rates themselves (Baltic Exchange TD/TC routes, Worldscale, Clarksons SIW) are licensed: shown as
  a declared gap unless a free, redistributable source exists. Bunker prices likewise.

**Phase 2:** LPG (Mont Belvieu propane spot, US propane stocks `WPRSTUS1`, EIA); other European power zones
(ENTSO-E); non-European markets: US gas storage and US LNG exports (EIA), US power (EIA-930), Japan power
(JEPX); EEX MiFID position reports for German power futures (verify terms); EUA carbon price source (EEX
auction results — verify terms).

Rules:
- **Yahoo Finance is unofficial and optional** (ADR 0003). Use it only for futures where no free official
  source exists. Show derived indicators (calendar spreads, curve structure, percentiles, z-scores) in
  preference to raw price tables. Label every affected chart "Yahoo Finance — unofficial, delayed,
  research only". If a fetch fails or is blocked, the UI shows the gap; nothing breaks.
- **Spot, stocks and fundamentals come only from official sources.**
- **Never mix price types in one spread** (spot vs futures, physical vs paper, auction vs index).
  Every price series records its `price_kind`; spreads are only computed between series of the same kind.
  Consequence: no clean spark/dark spreads in phase 1 (day-ahead power is spot; the only daily gas
  price is a futures contract). GB "day-ahead" is the Elexon market index price (MID), labelled as such,
  not the N2EX/EPEX auction price.
- **Licences:** confirm each source's licence when integrating it; store it in `series`; show the
  attribution under every chart that uses the series (in the `ChartCard` footer). If a source's terms
  forbid redistribution, the source is not used.
- **Units:** store in the source unit, convert in one place (`units` module). Display conventions:
  crude and products $/bbl (products also $/gal where the market quotes them; EU pump prices €/L), European gas €/MWh
  (NBP in p/therm where shown), US gas $/MMBtu, power €/MWh (DE, FR) and £/MWh (GB), storage in TWh and
  % full, flows in GWh/d, oil volumes in mb (million barrels; stored as kb = thousand barrels, EIA "MBBL"),
  oil flows in kb/d (mb/d for world balances). Currency conversion uses the FX series of the same date only.
  The site may rescale SI prefixes of the same unit for display (kWh/d → GWh/d, `lib/display-units.ts`);
  that is not a unit conversion, which only the worker's `units` module does.
- **Seasonal norms:** "vs 5Y" means same week (weekly data) or same month (monthly data) over the five
  prior years, excluding the current year. Document any excluded years (e.g. 2020).
- An existing Python project by the author contains working EIA/FRED clients, series IDs, seasonal-norm
  logic and futures-curve reconstruction: https://github.com/CorentinSTK/oil-tracker. Reuse what is sound;
  rewrite what is not. Credit it in the README.

---

## 5. Architecture

```
apps/web/      Next.js (App Router, TypeScript strict) — the site, deployed on Vercel
worker/        Python 3.12 — ingestion, transforms, forecasts, backtests; run by GitHub Actions cron
db/            SQL migrations for Supabase Postgres (versioned, applied in order)
docs/          Methodology notes, ADRs (architecture decision records), session log
.github/       CI (lint, typecheck, tests, build) and scheduled ingestion workflows
```

Monorepo with npm workspaces (one JS app; no Turborepo needed). Node 24 LTS, pinned in `.nvmrc` and CI.
The GitHub repository is public. See ADR 0001.

### Hosting and region (ADR 0001)

- **Frankfurt** for both: Supabase `eu-central-1` and Vercel functions `fra1` (both on AWS eu-central-1),
  so database round-trips stay inside one AWS region. Static pages are served from Vercel's global edge
  network regardless of the function region.
- Vercel's default function region is `iad1` (US East); it must be set to `fra1` in the project settings
  or `vercel.json`. Check that it is set at deploy.

### Front end (`apps/web`)

- Next.js (latest stable, App Router), React Server Components for data fetching, TypeScript `strict`.
- Tailwind CSS + shadcn/ui (Radix primitives) for accessible components; lucide-react icons.
- Charts: Apache ECharts through a thin in-house wrapper over `echarts/core` (tree-shaken; ADR 0002)
  for analytical charts — handles large time series, zoom, crosshair tooltips. One shared chart theme.
- Map: `react-simple-maps` or `d3-geo` with a bundled world TopoJSON (no API keys).
- State in the URL (`nuqs` or equivalent). Server-side caching with `revalidate` matched to data frequency.
- Fonts: Inter (UI) with tabular numerals for all figures; JetBrains Mono only for code.
- Dark and light themes; dark by default (trading-desk convention), both fully designed.

### Data and compute (`worker/`, `db/`)

- **Supabase Postgres** as the only datastore. Public read via a read-only role and Row Level Security;
  writes only from the worker with the service key (GitHub Actions secret, never in the repo).
- **Worker:** Python 3.12 (pinned with uv: `.python-version` + `requires-python`), `uv` for dependencies,
  `httpx` + `tenacity` (retries, backoff), `pandas`, `pydantic` for config and validation,
  `statsmodels` / `scikit-learn` / `lightgbm` for models. No deep learning in phase 1.
- **Scheduling:** GitHub Actions cron jobs per source (e.g. daily prices, weekly EIA on Wednesdays after
  release, daily power after the day-ahead auction). Each run writes an `ingest_runs` row
  (status `ok` / `partial` / `failed` / `skipped`, rows, duration, error). Cron start times can drift by
  several minutes; jobs must be idempotent (upserts on the primary key).
- **Cron keep-alive (M1, ADR 0001):** GitHub disables scheduled workflows in a public repository after
  60 days without repository activity. A monthly workflow commits a small state file
  (`ops/heartbeat.json`: date and workflow run ID) to a dedicated `ops/heartbeat` branch, so `main`
  history and branch protection are unaffected. `/data` shows stale sources, so a silent stop is visible.
  The mechanism is verified in M1 (that a bot commit counts as activity); if not, fall back to a
  re-enable call through the GitHub API.
- **Heavy computation** (backtests, simulations) runs in the worker or in a Next.js route handler with
  strict time limits; cache results keyed by parameters.

### Core schema (first version)

Tables live in schema `market`, site-facing views in schema `web`, read by the `web_reader` role
(ADR 0005). Tables are created in the milestone that first needs them: `series`, `observations` and
`ingest_runs` in M1; `futures_contracts` with the first futures source; forecast tables in M6.

```
series(id, code, name, commodity, region, unit, frequency, source, source_ref, description,
       is_unofficial, price_kind,                                  -- spot | futures | index | assessment | null
       license, license_url, attribution)                          -- attribution null = none required
observations(series_id, ts, value, ingested_at)                  -- PK (series_id, ts)
futures_contracts(contract, root, exchange, delivery_month, ts, settle, source, ingested_at)  -- PK (contract, ts)
ingest_runs(id, source, started_at, finished_at, status, rows_written, rows_rejected, error)
forecast_models(id, name, target_series_id, horizon, method, description, version)
forecasts(id, model_id, issued_at, target_ts, p05, p25, p50, p75, p95)   -- immutable once written
forecast_scores(forecast_id, realised_value, abs_error, in_80, in_90, scored_at)
```

Volume budget: Supabase free tier is limited (~500 MB). Power prices are stored at source resolution
(hourly DE/FR, half-hourly GB); load, generation and flows are stored per day as average power (MW) over
complete local delivery days (ADR 0006). Keep raw API payloads out of the database, and add indexes only
where queries need them. Series published every calendar day set `gap_threshold_days: 1` so a single
missing day is reported as a gap (migration 004).

`futures_contracts` (Yahoo data) is **not granted to the public read-only role**. The site reads only
derived views (spreads, curve structure, percentiles, z-scores) built from it (ADR 0003).
Supabase free projects pause after about a week without activity; the daily ingestion keeps them active.

---

## 6. Forecasts and scoring

The point is not to beat the market; it is to be **honest and measurable**.

- Every forecast is stored at issue time and **never edited**. It is scored automatically when the
  realised value arrives.
- Every model is compared with **simple baselines** (last value, seasonal naive, 5-year seasonal average).
  A model is only shown as useful if it beats its baseline out of sample.
- Report: MAE, RMSE, bias, skill vs baseline, and interval coverage (did 90% intervals contain 90%?).
- Historical performance comes from **walk-forward backtests** (expanding window, no look-ahead);
  live performance from the registry. Show both, clearly labelled.
- Exact rules (ADR 0009): a live forecast is refused if its outcome is already published, and can never
  be changed or deleted. Each forecast carries its baselines' forecasts for the same target. 90%
  intervals are the 5th–95th percentiles of earlier errors at the same horizon (at least 50). A model is
  said to beat its baselines only with ≥ 30 scored forecasts and a mean absolute error at least 5% lower
  than each baseline's; between 0 and 5% the site says "no clear edge".

Initial models (phase 1), chosen because the target is published on a fixed schedule:
1. **US weekly crude stock change** (EIA WPSR, Wednesday): seasonal baseline + regression on refinery
   runs, imports/exports and production trends.
2. **France daily power demand** (ODRÉ/éCO2mix, published daily): weather-driven regression on
   population-weighted HDD/CDD from Open-Meteo, with day-of-week and holiday effects. France's electric
   heating makes demand strongly temperature-sensitive, which keeps the model explainable.
3. **EU gas storage fill level in 30 days** (GIE): seasonal trajectory + recent injection pace.

Phase 2: day-ahead power price for 1–2 European zones (ENTSO-E) with load and renewables forecasts.

---

## 7. Lab

Two tools, both with honest outputs (costs, drawdowns, sample size, caveats).

1. **Rule backtester** on spreads and outright series. Presets (M7, ADR 0010): DE–FR day-ahead spread
   mean reversion, Brent–WTI mean reversion, 3-2-1 crack at a three-year low, diesel crack vs US
   distillate stocks against their seasonal norm, Brent above its 100-day average. The spec's original
   futures-spread and US gas storage presets wait for data with a usable history. The user sets entry/exit
   rules from a small, safe rule grammar (thresholds, z-scores, percentiles, crossovers) — never
   arbitrary code. Output: equity curve, drawdown, trade list, hit rate, average win/loss, Sharpe,
   turnover, cost sensitivity, and an explicit "in-sample" warning.
2. **Trade simulator** (Monte-Carlo): pick a series, an entry level, a stop and a target; simulate paths by
   block bootstrap of historical changes (regime selectable: full history, crisis periods, calm periods);
   show fill probability, P&L distribution, probability of target vs stop, expected time in trade.

---

## 8. Design system

- **Tokens** (CSS variables): background, surface, border, text primary/secondary/muted, accent,
  positive/negative, warning; commodity colours (crude, products, natural gas, LNG, LPG, power) used
  identically everywhere. Validate contrast (WCAG AA) in both themes.
- **Charts:** one axis per chart (no dual axes); units in the title or axis; thin lines; recessive grid;
  crosshair tooltip with exact values and dates; source + last date under each chart; seasonal charts
  show the 5-year min–max band and average with the current year highlighted.
- **Components to build once and reuse:** `KpiCard`, `ChartCard` (title, takeaway, chart, footer with
  source/attribution/freshness/methodology, and the unofficial-data label where it applies), `FreshnessBadge`, `MethodPopover`, `MarketHeader`, `DataGapNotice`,
  `Skeleton`, `ErrorState`, `EmptyState`.
- **Numbers:** tabular numerals; consistent precision per unit; thousands separators; explicit signs on
  changes; percentiles as "92nd pct".
- **Motion:** subtle and fast (≤150 ms); no decorative animation.
- Before building pages, produce a small style-guide page (`/styleguide`, not linked publicly) showing
  every component in both themes.

---

## 9. Quality bar

- TypeScript `strict`, ESLint, Prettier; Python `ruff` (lint + format), `mypy` on the worker core, `pytest`.
- Data validation on every ingest: schema, units, plausible ranges, duplicates, gaps; failures are logged
  in `ingest_runs` and surfaced on `/data`, never silently dropped.
- Unit tests for every transform (seasonal norms, spreads, unit conversions, curve rebuild, scoring).
- Playwright smoke tests for the main pages; Lighthouse ≥ 90 on performance and accessibility.
- CI on every push: lint, typecheck, tests, build. Main branch always deployable.
- No secrets in the repo: `.env.example` documents every variable; real values live in Vercel and
  GitHub Actions secrets.
- Readable code over clever code; short functions; docstrings on non-obvious logic; no dead code.

---

## 10. Milestones

Work one milestone at a time. Each ends with a demo to the user and their approval before the next.

| # | Milestone | Done when |
|---|---|---|
European markets come first: they are the focus and the most differentiating part for European desks.

| # | Milestone | Done when |
|---|---|---|
| M0 | Scaffold, design system, CI, deploy | Monorepo builds; `/styleguide` (noindex, synthetic demo data with a "DEMO — synthetic data, not market data" banner on every card) shows all core components in both themes; CI green; site live on Vercel (`fra1`) |
| M1 | Data platform | Schema migrated (with `price_kind`, `license`, `attribution`); read-only role and RLS; ingestion framework with retries, rate-limit handling, validation and `ingest_runs`; cron keep-alive verified; units and FX modules; GIE AGSI+, EIA and FRED live; `/data` shows catalogue, licence, freshness and gaps |
| M2 | European gas & LNG | `/markets/gas` (storage by country vs seasonal, ENTSOG flows, official monthly benchmark, TTF derived indicators from Yahoo, labelled) and `/markets/lng` (GIE ALSI); positioning shown as a declared gap (ICE terms) |
| M3 | European power | `/markets/power` for DE, FR, GB: day-ahead prices, load, generation mix (ENTSO-E, SMARD, ODRÉ, Elexon; Energy-Charts as cross-check); GB labelled as Elexon MID |
| M4 | Crude & products | Both pages per template (global view): EIA spot and stocks, EC Weekly Oil Bulletin, Yahoo curve indicators (labelled), CFTC COT (WTI, RBOB, ULSD); Brent and gasoil positioning as a declared gap |
| M5 | Home | Europe map (hubs, power zones, LNG terminals, entry points) + world view (oil, chokepoints), metric selector, drawers, "today in energy" |
| M6 | Forecast registry | Three phase-1 models (§6, see §11), walk-forward backtests, live registry, scoreboard pages |
| M7 | Lab v1 | Rule backtester with European presets and the trade simulator |
| M8 | Polish & launch | Methodology (incl. Data licensing) and About pages, README with screenshots, Lighthouse ≥ 90, mobile pass, error monitoring |
| F | Freight & shipping (later phase) | `/markets/freight`: chokepoint transits, computed route distances and voyage times, links to the crude, products and LNG pages; freight rates only if a redistributable source exists |
| P2 | Phase 2 | LPG; other European power zones; non-European markets (US gas and power, Asia); day-ahead power price forecast; carbon (EUA) if a redistributable source exists |

---

## 11. Open decisions (ask the user when relevant)

- Final project name and domain. ("Energy Desk" is the working name.)
- Which other European power zones in phase 2.
- Whether to add a French/English language toggle.
- ~~Lab presets (§7)~~ — decided at M7 (2026-10-31): presets on long official series only (see §7 and
  ADR 0010); TTF and Brent M1–M2 presets once the stored futures history is long enough.
- Carbon (EUA): no confirmed free, redistributable daily price yet (needed for clean spark/dark spreads).
- Freight & shipping: when to schedule the phase, and which free sources hold up (freight rates and bunker
  prices are licensed; chokepoint transits and computed voyage times are the likely free core).


Decided on 2026-10-28 (see ADRs 0001–0004): Europe focus; public repository; Python 3.12; Frankfurt region;
Yahoo Finance policy; licence tracking per series; milestones M0–M8; forecast model 2 is France daily
power demand (replacing US gas storage).

Decided on 2026-10-28 (M2 planning):
- EIA spot prices (WTI, Brent, Henry Hub) are kept, attributed to EIA with Refinitiv (LSEG) as the
  underlying source named by EIA.
- ICE COT is not used (terms forbid republication); European positioning is a declared gap.
- Yahoo TTF: the front-month level appears only as a single KPI with the unofficial label; charts show
  derived indicators only (M1–M2 spread, percentiles). Derived series are computed by the worker; raw
  settlements stay in `futures_contracts`, which the site cannot read (ADR 0003).
