# ADR 0007 — Oil sources, futures expiry rules and units

- Status: accepted
- Date: 2026-10-30

## Context

M4 covers crude oil and refined products as global markets. The data has to be free and
redistributable. That rules out Platts and Argus assessments, ICE settlements and ICE Commitments of
Traders, ARA stocks, and the IEA and OPEC reports.

## Decision

### Sources (checked live on 2026-10-30)

- **EIA** (public domain), with series added to the existing source:
  - spot prices for products;
  - the weekly WPSR: stocks, production, trade, refinery runs and product supplied;
  - the STEO: world balance and OPEC capacity.
  - Weekly production lives on the route `petroleum/sum/sndw`. The route named in the spec, `crd/crpdn`,
    is monthly only.
  - The STEO uses the `seriesId` facet and monthly periods.
- **The STEO is stored as history only.** STEO series continue to December of next year, and nothing marks
  where history ends. Only months before the current month are kept, so forecasts are never stored as
  observations. The latest months are still EIA estimates, revised in each release; the descriptions say
  so. The forecast part is a candidate benchmark for the forecast registry (M6).
- **CFTC Commitments of Traders** (public domain, with acknowledgement), disaggregated, futures only:
  - markets covered: NYMEX WTI (067651), RBOB (111659) and NY Harbor ULSD (022651);
  - series are addressed by contract code, because the market names changed in 2022;
  - raw longs, shorts and open interest are stored, and the site computes the nets;
  - the CFTC "Brent Last Day" market is the small NYMEX look-alike and is not used. Brent and gasoil
    positioning stay declared gaps (ICE terms).
- **European Commission Weekly Oil Bulletin** (CC BY 4.0 under the Commission legal notice):
  - Euro-super 95 and diesel, with and without taxes, for the EU, the euro area and the 27 member states;
  - source: the history workbook, weekly since 2005, in €/1,000 L;
  - columns are read by name, and a changed unit or a non-numeric cell fails the run.
- **Crack spreads** are computed by the worker from EIA spots of the same date only:
  - USGC 3-2-1 against WTI;
  - NYH ULSD against Brent;
  - $/gal is converted to $/bbl through the units module.

### Futures: generic months from expiry rules

- Yahoo lists NYMEX oil contracts more than a year ahead, so the site can show curve structure as spreads
  M1 − Mn (ADR 0003: no raw futures prices on the site).
- M1 is the first contract whose last trading day has not passed. The rules come from CME, adapted from
  the author's oil-tracker project:
  - CL: 3 business days before the 25th of the month before delivery;
  - BZ: last business day of the second month before delivery;
  - HO and RB: last business day of the month before delivery;
  - TTF keeps its "month after the trading date" rule.
- Business days are weekdays only. A date is used only if the rule's front contract settled that day and no
  earlier contract did. A holiday that shifts an expiry therefore produces a gap, never a curve with the
  wrong front month.
- Yahoo can append a live quote dated like the last daily bar; only the first point of each date is kept.

### Units

- EIA "MBBL" (thousand barrels) is stored as `kb`, and "MBBL/D" as `kb/d`. STEO million barrels per day is
  `mb/d`, the IEA and OPEC convention.
- The site shows stocks in `mb` (million barrels) and bulletin prices in €/L, by display rescaling. Values
  are stored in the source unit.
- Before M4, "mb" meant thousand barrels; the two existing series only changed their unit label.

### Weekly seasonal norm

- `web.seasonal_weekly` (migration 005) compares each ISO week with the same week of the five prior ISO
  years.
- Week 53 is folded into week 52 and keeps the later observation, so every value shown is a stored row.

## Consequences

- About 300,000 new rows (about 30 MB).
- Curve history grows from October 2026. The CL M1 spreads start on 21 October 2026, the day after the
  November contract expired and left Yahoo.
- The products main chart shows the cracks as a time series rather than against a seasonal band. A
  daily seasonal band breaks on every weekend for a trading-day series.
- European refining margins (NWE cracks) and non-US stocks remain declared gaps.
