# ADR 0006 — Power sources and storage resolution

- Status: accepted
- Date: 2026-10-29

## Context

M3 covers power for Germany (DE-LU), France and Great Britain: day-ahead prices, load and generation
mix. The spec named ENTSO-E as the main source, but its token is issued by email request and had not
arrived. The Supabase free tier is limited to about 500 MB, and the database held 43 MB before M3.

## Decision

### Sources (all keyless, open licences, checked live on 2026-10-29)

- **SMARD** (Bundesnetzagentur, CC BY 4.0) for DE-LU and France day-ahead prices, German load and German
  generation by fuel. The France price (filter 254) and the DE-LU price match Energy-Charts exactly
  (`worker.crosscheck power`: 0 differences over 193 hours).
- **RTE éCO2mix via ODRÉ** (Licence Ouverte v2.0) for French consumption, generation and exchanges.
  Consolidated data wins over real-time data for the same half-hour.
- **Elexon** (BMRS data licence) for Great Britain: the market index (MID, APX provider) is an index of
  short-term trades, not an auction price. It is labelled "Elexon MID", stored with `price_kind=index`, and
  never put in a spread with DE/FR auction prices.
- **ENTSO-E** becomes a cross-check and the source for other zones in phase 2. It does not block M3.

### Storage resolution

- Prices at source resolution: hourly for DE-LU and France, half-hourly for GB (new `half_hourly`
  frequency, migration 003). Intraday gap thresholds are 1.5 periods.
- Load, generation and flows **per day, as average power in MW** over the complete local delivery day
  (Europe/Berlin, Europe/Paris, Europe/London). Average power is not distorted by 23- or 25-hour
  clock-change days. Hourly generation for 30 series over six years would be about 1.5 million rows
  (about 160 MB); the daily form is about 70,000 rows.
- Daily base prices are the time average of the intraday prices over the same local day.
- A day is stored only if **every** hour or settlement period has a value (`worker/power.py`).
  Incomplete days are gaps, never partial averages.
- Daily power series set `gap_threshold_days: 1` (migration 004), because the daily default of 5 days
  is meant for business-day series.

### Display

- Generation is grouped by fuel in the web layer. Each group sums distinct categories reported by the
  source, and each fuel keeps the same colour in every zone.
- Renewable share = (wind, solar, hydro excluding pumped storage, bioenergy) ÷ reported generation.
- Group sums and shares keep a date only when every series that had started reporting has a value
  (`lib/power.ts`). A series that had not started yet (e.g. an interconnector commissioned later) counts
  as zero before its first observation.

## Consequences

- There is no hourly generation chart. If one is needed, hourly data can be kept for a rolling window
  in a later milestone.
- GB generation excludes embedded solar and wind, and GB demand (INDO) is transmission-metered. Both
  are declared gaps.
- Clean spark and dark spreads stay out of scope: there is no daily spot gas price and no free carbon
  price.
- The Elexon licence text must be confirmed by reading the page in a browser. The page is behind a bot
  check, and its terms were read through a search summary.
