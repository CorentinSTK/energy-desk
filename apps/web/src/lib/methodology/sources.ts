/**
 * The data-licensing table of /methodology, built from the series catalogue so it always matches what
 * is stored and shown (/data uses the same catalogue).
 */

import { resolveAttribution } from "@/lib/data/attribution";
import type { CatalogSeries } from "@/lib/data/catalog";
import { SOURCE_LABELS } from "@/lib/data/filters";

export interface SourceSummary {
  source: string;
  label: string;
  series: number;
  /** Distinct licences of the source's series (a source may have per-series licences). */
  licences: { name: string; url: string | null }[];
  attributions: string[];
  unofficial: boolean;
}

export function summariseSources(
  catalog: CatalogSeries[],
  extractionDates: Record<string, string>,
): SourceSummary[] {
  const bySource = new Map<string, CatalogSeries[]>();
  for (const s of catalog) bySource.set(s.source, [...(bySource.get(s.source) ?? []), s]);
  return [...bySource.entries()]
    .map(([source, series]) => {
      const licences = new Map<string, string | null>();
      for (const s of series) if (!licences.has(s.license)) licences.set(s.license, s.licenseUrl);
      const attributions = [
        ...new Set(
          series
            .map((s) => resolveAttribution(s.attribution, s.source, extractionDates))
            .filter((a): a is string => a !== null),
        ),
      ];
      return {
        source,
        label: SOURCE_LABELS[source] ?? source,
        series: series.length,
        licences: [...licences.entries()].map(([name, url]) => ({ name, url })),
        attributions,
        unofficial: series.some((s) => s.isUnofficial),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
