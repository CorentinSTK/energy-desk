# ADR 0002 — Apache ECharts through a thin in-house wrapper

- Status: accepted
- Date: 2026-10-28

## Context

The spec allows ECharts "via `echarts-for-react` or a thin wrapper". Charts must handle 10+ years of daily
data, crosshair tooltips and zoom, and share one theme.

## Decision

Write a small client component (`EChart`, about 40 lines) over `echarts/core`. It registers only the chart
types and components we use (line, bar, custom band, grid, tooltip, dataZoom, mark lines) and the canvas
renderer. It handles init, option updates, resize, theme switch and dispose.

## Why

- **Bundle size.** Importing `echarts/core` with explicit modules is tree-shaken. The full `echarts`
  import that most wrappers use pulls in every chart type.
- **Fewer dependencies.** `echarts-for-react` is a thin layer itself and changes rarely. Owning the 40 lines
  removes a dependency and makes theme switching (dark/light) explicit.
- **One chart theme.** The wrapper is the single place where design tokens become an ECharts theme.

## Consequences

- When we need a new chart type, we register it in the wrapper.
- Charts are client components. Data is fetched in server components and passed in as props.
