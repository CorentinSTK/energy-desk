import type { ChartSourceInfo } from "@/components/chart-card";
import { UNOFFICIAL_LABEL } from "@/components/data-labels";
import { resolveAttribution } from "@/lib/data/attribution";
import type { CatalogSeries } from "@/lib/data/catalog";
import { SOURCE_LABELS } from "@/lib/data/filters";
import { displayUnit } from "@/lib/display-units";
import { freshnessStatus } from "@/lib/freshness";

/**
 * Footer of a ChartCard from the series catalogue: source, unit as displayed, last observation,
 * freshness (net of publication lag), attribution (with the extraction date filled in) and the
 * unofficial flag. Several series from the same source share one footer.
 */
export function chartInfo(
  series: CatalogSeries[],
  extractionDates: Record<string, string>,
  now: Date,
): ChartSourceInfo {
  const first = series[0];
  const last = series
    .map((s) => s.lastObservation)
    .filter((ts): ts is string => ts !== null)
    .sort()
    .at(-1);
  const attributions = [
    ...new Set(series.map((s) => resolveAttribution(s.attribution, s.source, extractionDates))),
    // The unofficial warning is shown on its own line; do not repeat it as an attribution.
  ].filter((a): a is string => a !== null && a !== UNOFFICIAL_LABEL);
  return {
    source: [...new Set(series.map((s) => SOURCE_LABELS[s.source] ?? s.source))].join(", "),
    attribution: attributions.join(" ") || undefined,
    unit: displayUnit(first.unit).unit,
    lastObservation: last,
    freshness: last
      ? freshnessStatus(new Date(last), first.frequency, now, first.publicationLagDays)
      : undefined,
    unofficial: series.some((s) => s.isUnofficial),
  };
}
