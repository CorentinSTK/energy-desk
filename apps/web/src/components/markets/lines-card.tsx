import type { ReactNode } from "react";

import { ChartCard } from "@/components/chart-card";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints, type Points } from "@/lib/data/series";
import { displayUnit, rescale } from "@/lib/display-units";

interface Line {
  code: string;
  name: string;
  colorIndex?: number;
}

interface LinesCardProps {
  ctx: PageContext;
  title: string;
  method: ReactNode;
  /** Source label when the series are not in the catalogue yet (fallback footer). */
  source: string;
  lines: Line[];
  days: number;
  decimals: number;
  height: number;
  ariaLabel: string;
  unofficial?: boolean;
  /** Sentence from the loaded series (display units), in the order of `lines`. */
  takeaway?: (series: Points[]) => string | undefined;
}

/**
 * Several series of the same unit on one chart, each as stored (rescaled for display only). Lines
 * are never combined here: a computed series (spread, net) is built by the caller.
 */
export async function LinesCard({
  ctx,
  title,
  method,
  source,
  lines,
  days,
  decimals,
  height,
  ariaLabel,
  unofficial = false,
  takeaway,
}: LinesCardProps) {
  const from = daysAgo(ctx.now, days);
  const loaded = await Promise.all(lines.map((l) => attempt(l.code, getPoints(l.code, from))));
  const meta = seriesOf(ctx, ...lines.map((l) => l.code));
  const sourceUnit = meta[0]?.unit ?? "";
  const unit = displayUnit(sourceUnit).unit;
  const scaled = loaded.map((points) => (points ? rescale(points, sourceUnit) : null));
  const failed = scaled.some((s) => s === null);
  const empty = scaled.every((s) => s === null || s.length === 0);

  return (
    <ChartCard
      title={title}
      takeaway={!failed && !empty ? takeaway?.(scaled as Points[]) : undefined}
      method={method}
      info={chartInfo(meta, ctx.extractionDates, ctx.now, { source, unit, unofficial })}
      status={failed ? "error" : empty ? "empty" : "ready"}
      height={height}
    >
      <MultiLineChart
        series={lines.map((l, i) => ({
          name: l.name,
          data: scaled[i] ?? [],
          colorIndex: l.colorIndex,
        }))}
        unit={unit}
        decimals={decimals}
        height={height}
        ariaLabel={ariaLabel}
      />
    </ChartCard>
  );
}
