# ADR 0017 — ENTSO-E: only data on the free re-use list

- Status: accepted
- Date: 2026-11-25

## Context

The ENTSO-E Transparency Platform token arrived in November 2026. The platform publishes load,
generation per type, generation unit outages (including French nuclear availability), prices and grid
data for every European zone. The owner first suggested taking everything, since the project is
non-commercial.

ENTSO-E's Terms of Use (29/03/2023, clause 2.5) and its "List of data available for free re-use"
(18/10/2023), read on 2026-11-25 from the platform's help centre, say:
- listed data may be copied, redistributed and adapted for any purpose under CC BY 4.0, with credit
  to the source and an indication of changes, without the agreement of the primary data owners;
- data not on the list needs the agreement of its primary owner (TSOs, exchanges) to be re-used;
- exceptions on the list: Moldova, Turkey, some Ukraine items, and the BritNed, IFA and Nemo Link
  interconnectors.

On the list: load forecasts (6.1.b–e), grid unavailability (10.1), cross-zonal capacities and
flow-based parameters (11.1), explicit allocations (12.1.a–c), physical flows (12.1.g), redispatching
and countertrading (13.1), balancing and imbalance data (17.1, 17.2 and the balancing and system
operation guidelines). Not on it: actual load (6.1.a), generation forecasts (14.1), generation unit
unavailability (15.1), actual generation per type and per unit (16.1), day-ahead prices (12.1.d).

## Decision

- Ingest only items on the free re-use list. The site is public and shown to employers: publishing
  is redistribution, whatever the purpose. The project rule against licensed data (CLAUDE.md) applies.
- First item: net physical flows (art. 12.1.g) on the 13 borders between the site's eight zones,
  stored as daily averages in MW, attributed "ENTSO-E Transparency Platform (CC BY 4.0)" with a note
  that daily averages are computed by Energy Desk.
- French nuclear availability stays a declared gap: EDF's open daily dataset no longer exists (the
  portal answers "Dataset not found"), its open annual dataset is too coarse, and RTE's outage API
  has no stated open licence. French nuclear output (RTE éCO2mix, already ingested) is the open proxy.

## Consequences

- No generation mix, load or outages for NL, BE, AT, CH, IT-North and PL.
- The list is versioned; it must be re-read before adding another ENTSO-E item.
- The API is slow (tens of seconds per request) and limited to one year per request: the source uses
  a longer timeout and yearly windows.
