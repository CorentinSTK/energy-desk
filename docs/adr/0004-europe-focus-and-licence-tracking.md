# ADR 0004 — Europe focus and per-series licence tracking

- Status: accepted
- Date: 2026-10-28

## Context

The target users are energy desks in London, Berlin and Paris. The first version of the spec was
US-centric (EIA first, US gas, US power in phase 2). Free European sources each have their own licence
(CC BY 4.0, Licence Ouverte, provider-specific terms), and several require attribution.

## Decision

### Scope

- Phase 1: European gas (GIE AGSI+, ENTSOG), European LNG (GIE ALSI), power for DE, FR and GB (ENTSO-E,
  SMARD, ODRÉ/éCO2mix, Energy-Charts, Elexon), and crude and products as global markets (EIA, FRED).
- Phase 2: LPG, other power zones, non-European markets.
- The home map is centred on Europe, with a world view for oil and chokepoints.
- Positioning: CFTC COT for WTI and Henry Hub. ICE Futures Europe COT was planned first, but ICE's terms
  forbid republication (checked 2026-10-28), so European positioning is a declared gap.

### Licences

- We confirm each source's licence from its own terms when we integrate it, not from memory.
- `series` gets `license`, `license_url` and `attribution` columns. A null `attribution` means none is
  required.
- `ChartCard` shows the attribution of every series it plots. `/data` lists the licence of every series.
- A source whose terms forbid redistribution is not used.

### Price kinds

`series.price_kind` (spot, futures, index, assessment) is stored, so the rule "never mix price types in one
spread" is enforced in code. GB day-ahead is the Elexon market index price (MID), labelled as such.

## Consequences

- Milestones are reordered: European gas & LNG, then power, before crude & products (BUILD_SPEC §10).
- Some European prices have no free daily official source (NBP, THE, PEG, ARA gasoil, EUA). They appear as
  data gaps, and clean spark/dark spreads are out of scope for phase 1.
- Forecast model 2 changes from US weekly gas storage to France daily power demand (BUILD_SPEC §6).
