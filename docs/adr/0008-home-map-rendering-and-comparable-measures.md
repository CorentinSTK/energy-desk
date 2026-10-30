# ADR 0008 — Home map: server-rendered SVG and comparable measures

- Status: accepted
- Date: 2026-10-30

## Context

The home page map (M5) shows very different series side by side: storage filling levels, day-ahead
power prices, pump prices, LNG send-out, pipeline flows and oil prices. They have different units,
frequencies and publication delays. The map must stay light on a phone, work with a keyboard, and
never estimate a missing value.

## Decision

### Rendering

- Country shapes come from world-atlas 2.0.2 (ISC), which is derived from Natural Earth (public domain):
  1:50m for Europe and 1:110m for the world.
- They are projected **on the server** with d3-geo: a conic conformal projection for Europe and
  Natural Earth for the world. The browser receives plain SVG paths, rounded to 0.1 px (under 300 KB of
  paths for Europe). It gets no map library and no TopoJSON.
- Every coloured country and marker is an SVG link that sets `?focus=`. The tooltip is the native
  `<title>`. The side panel is rendered on the server from the URL. The map therefore works without
  JavaScript and with a keyboard, and every selection is a shareable link. The same values are also
  shown as a table.
- `react-simple-maps` was not used. It projects in the browser and adds nothing d3-geo does not do.

### Measures (migration 006, `web.series_snapshot`)

- **vs 5-year average**: (latest − mean of the same calendar day, ISO week or month over the five prior
  years) ÷ |mean|, in %. It needs at least 3 prior years.
- **Latest move**: the latest change ÷ the standard deviation of the changes over the year before it, a
  z-score. It needs at least 20 earlier changes.
- **5-year percentile**: the share of the past five years' observations at or below the latest one.
- The colour scales use fixed bins (±5/15/30 %, ±1/2/3σ, quintiles). Below and above the norm are
  shown in blue and orange, which carry no "good" or "bad" meaning.

### Layers

In the Europe view, countries show one layer at a time (gas storage, power prices or diesel pump
price), because a country can only carry one colour. Markers keep their own series.

### Positions

Markers are placed at the nearest Natural Earth port or town, or at the centroid of a marine area.
`lib/geo/markers.ts` records the source of each position and the distance when the place is not on site
(up to about 50 km). Positions are used for drawing only. Gas hubs are virtual and are drawn at their
capital.

## Consequences

- The map's dates differ between series (daily, weekly, delayed). The panel and the table show each date.
- The map compares relative measures, not levels. Levels are on the market pages and in the panel.
- Touch targets for markers are small on a phone. The table of values is the accessible alternative.
