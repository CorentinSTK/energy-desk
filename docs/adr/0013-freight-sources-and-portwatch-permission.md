# ADR 0013 — Freight sources and the PortWatch permission

- Status: accepted
- Date: 2026-11-20

## Context

Phase F (`/markets/freight`) shows how energy moves by sea. The free, official candidate for
chokepoint activity is **IMF PortWatch**, which counts daily transits from AIS vessel signals. It was
checked live on 2026-11-20:
- **Daily_Chokepoints_Data**:
  - 28 chokepoints, one row per day since 2019-01-01, about five days behind;
  - transit counts (`n_total`, `n_tanker`);
  - an IMF *estimate* of tonnage carried (`capacity_tanker`: modelled payload times deadweight, in
    metric tons).
- **portwatch_disruptions_database**: named events with the chokepoints they affect. For example,
  "HORMUZ-26 — Trade Disruptions in the Strait of Hormuz", from 1 Mar 2026, ongoing, alert level RED.
  Over the same period, Hormuz transits fall from about 78 to about 3 a day.

Both datasets are published under the **IMF Copyright and Usage terms**, linked from the ArcGIS item
and the HDX datasets. Those terms allow downloading, publishing and distributing data with the
attribution "Source: International Monetary Fund, <database>, <link>". They require permission for
**commercial reuse**, which does not apply here, and for **systematic or automated downloading**,
which a daily ingestion is.

Freight rates (Baltic Exchange TD/TC routes, Worldscale, Clarksons) and bunker prices are licensed.

## Decision

- Use PortWatch for eight energy chokepoints: Hormuz, Bab el-Mandeb, Suez, Cape of Good Hope,
  Malacca, Panama, Bosporus and Gibraltar. Each has three series: transits, tanker transits and
  tanker tonnage.
  - Series are in a new `freight` category (migration 011).
  - Tonnage is always labelled as an IMF estimate.
  - Disruption events are stored as published in `market.shipping_events`, and never interpreted
    beyond their text.
- **Ask before ingesting.** The owner emails IMF-PortWatch@IMF.ORG to ask permission for this use:
  - one query per chokepoint per day;
  - a one-time history download of about 23,000 rows.
  The source is built and testable by dry run in the meantime. It is not added to the scheduled
  workflows or backfilled in production until the IMF agrees. If they refuse, or prefer another
  access route, this ADR is revised.
- Attribution under every chart: "Source: International Monetary Fund, PortWatch".
- Freight rates and bunker prices are **declared gaps** on the freight page.

## Consequences

- Until permission arrives, the freight page can show only what needs no PortWatch data (computed
  routes, declared gaps). Chokepoint charts say the data is pending the source's permission.
- PortWatch counts are model outputs from AIS signals, not customs or port records. AIS gaps (for
  example jamming or switched-off transponders) lower the counts. The page says so.
- About five days of publication lag: freshness uses `publication_lag_days: 5`.
