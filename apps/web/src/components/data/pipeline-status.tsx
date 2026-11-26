import type { CatalogSeries, IngestRun } from "@/lib/data/catalog";
import { SOURCE_LABELS } from "@/lib/data/filters";
import { sourceHealth, type SourceHealth } from "@/lib/data/source-health";
import { cn } from "@/lib/utils";

const OVERALL: Record<SourceHealth["overall"], { label: string; dot: string }> = {
  fresh: { label: "All fresh", dot: "bg-status-fresh" },
  delayed: { label: "Some delayed", dot: "bg-status-delayed" },
  stale: { label: "Some stale", dot: "bg-status-stale" },
  failed: { label: "Last run failed", dot: "bg-status-stale" },
};

function utc(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** One tile per source: latest run and series freshness. Problems are shown, never hidden. */
export function PipelineStatus({
  catalog,
  runs,
  now,
}: {
  catalog: CatalogSeries[];
  runs: IngestRun[];
  now: Date;
}) {
  const health = sourceHealth(catalog, runs, now);
  return (
    <section id="pipeline" aria-labelledby="pipeline-title" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pipeline-title" className="text-lg font-semibold">
          Pipeline status
        </h2>
        <p className="text-xs text-muted-foreground">
          Latest ingestion per source (UTC) and freshness of its series against their publication
          rhythm.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {health.map((h) => {
          const overall = OVERALL[h.overall];
          const total = h.series.fresh + h.series.delayed + h.series.stale;
          return (
            <li key={h.source} className="space-y-2 rounded-xl border bg-card p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{SOURCE_LABELS[h.source] ?? h.source}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-text-secondary">
                  <span className={cn("size-1.5 rounded-full", overall.dot)} aria-hidden />
                  {overall.label}
                </span>
              </div>
              {/* Freshness bar: one segment per status, proportional to its series count. */}
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                {(["fresh", "delayed", "stale"] as const).map((k) =>
                  h.series[k] > 0 ? (
                    <span
                      key={k}
                      className={cn(
                        k === "fresh" && "bg-status-fresh",
                        k === "delayed" && "bg-status-delayed",
                        k === "stale" && "bg-status-stale",
                      )}
                      style={{ width: `${(h.series[k] / total) * 100}%` }}
                    />
                  ) : null,
                )}
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {total} series: {h.series.fresh} fresh, {h.series.delayed} delayed, {h.series.stale}{" "}
                stale
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {h.latestRun
                  ? `Last run ${utc(h.latestRun.startedAt)}: ${h.latestStatus}`
                  : "No run in the recent log"}
                {h.latestRun?.status !== "ok" && h.lastSuccessAt
                  ? ` · last success ${utc(h.lastSuccessAt)}`
                  : ""}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
