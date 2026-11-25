/**
 * Pipeline status per source: the latest ingestion run and how fresh the source's series are.
 * Computed from the catalogue and the recent runs the /data page already loads.
 */

import type { CatalogSeries, IngestRun } from "@/lib/data/catalog";
import { freshnessStatus, type FreshnessStatus } from "@/lib/freshness";

export interface SourceHealth {
  source: string;
  latestRun: IngestRun | null;
  /** Latest run that finished "ok" or "partial". */
  lastSuccessAt: string | null;
  series: Record<FreshnessStatus, number>;
  /** Overall: "failed" if the latest run failed, else the worst series freshness. */
  overall: FreshnessStatus | "failed";
}

const RANK: Record<FreshnessStatus, number> = { fresh: 0, delayed: 1, stale: 2 };

export function sourceHealth(
  catalog: CatalogSeries[],
  runs: IngestRun[],
  now: Date,
): SourceHealth[] {
  const sources = [...new Set(catalog.map((s) => s.source))].sort();
  return sources.map((source) => {
    const series: Record<FreshnessStatus, number> = { fresh: 0, delayed: 0, stale: 0 };
    for (const s of catalog) {
      if (s.source !== source) continue;
      const status = s.lastObservation
        ? freshnessStatus(new Date(s.lastObservation), s.frequency, now, s.publicationLagDays)
        : "stale";
      series[status] += 1;
    }
    const own = runs
      .filter((r) => r.source === source)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const latestRun = own[0] ?? null;
    const lastSuccessAt =
      own.find((r) => (r.status === "ok" || r.status === "partial") && r.finishedAt)?.finishedAt ??
      null;
    const worst = (Object.keys(series) as FreshnessStatus[])
      .filter((k) => series[k] > 0)
      .sort((a, b) => RANK[b] - RANK[a])[0];
    return {
      source,
      latestRun,
      lastSuccessAt,
      series,
      overall: latestRun?.status === "failed" ? "failed" : (worst ?? "fresh"),
    };
  });
}
