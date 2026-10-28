/**
 * Design tokens resolved for a chart. ECharts draws on a canvas and cannot read CSS variables, so we
 * read them from the chart's own container: a chart inside a `.light` panel gets light colours even on
 * a dark page.
 */

import { COMMODITIES, type Commodity } from "@/lib/commodities";

export interface ChartTokens {
  text: string;
  textSecondary: string;
  axis: string;
  grid: string;
  band: string;
  average: string;
  surface: string;
  border: string;
  fontFamily: string;
  commodity: Record<Commodity, string>;
  /** Categorical palette for several series in one chart. */
  series: string[];
}

const SERIES_PALETTE_SIZE = 9;

export function readChartTokens(element: HTMLElement): ChartTokens {
  const style = getComputedStyle(element);
  const v = (name: string) => style.getPropertyValue(name).trim();
  const commodity = Object.fromEntries(
    (Object.keys(COMMODITIES) as Commodity[]).map((c) => [c, v(COMMODITIES[c].cssVar)]),
  ) as Record<Commodity, string>;

  return {
    text: v("--foreground"),
    textSecondary: v("--text-secondary"),
    axis: v("--chart-axis"),
    grid: v("--chart-grid"),
    band: v("--chart-band"),
    average: v("--chart-avg"),
    surface: v("--surface-raised"),
    border: v("--border"),
    fontFamily: style.fontFamily,
    commodity,
    series: Array.from({ length: SERIES_PALETTE_SIZE }, (_, i) => v(`--chart-series-${i + 1}`)),
  };
}
