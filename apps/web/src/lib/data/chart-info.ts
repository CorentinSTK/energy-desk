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
 * unofficial flag. Several series from the same source share one footer. Never throws: with no
 * catalogue entry it returns the fallback, and the card shows its empty state.
 */
export function chartInfo(
  series: CatalogSeries[],
  extractionDates: Record<string, string>,
  now: Date,
  /**
   * Shown when the series is not (yet) in the catalogue, e.g. a source not ingested yet. For an
   * unofficial source, set `unofficial` so the mandatory label never depends on the catalogue.
   */
  fallback: { source: string; unit: string; unofficial?: boolean },
): ChartSourceInfo {
  const first = series.at(0);
  if (!first) return fallback;
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
    // One link only when every series shares the licence; /data lists each series' licence.
    licenseUrl: attributions.length > 0 ? sharedLicenseUrl(series) : undefined,
    unofficial: series.some((s) => s.isUnofficial),
  };
}

function sharedLicenseUrl(series: CatalogSeries[]): string | undefined {
  const urls = new Set(series.map((s) => s.licenseUrl));
  const [only] = urls;
  return urls.size === 1 && only ? only : undefined;
}
