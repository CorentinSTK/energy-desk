import { ChartCard } from "@/components/chart-card";
import { SeasonalChart } from "@/components/charts/seasonal-chart";
import { compareWithSeason } from "@/lib/analytics";
import type { Commodity } from "@/lib/commodities";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPointsMany } from "@/lib/data/series";
import { combineDaily, seasonalFromDaily } from "@/lib/seasonal";
import { seasonalAbsoluteTakeaway, seasonalLevelTakeaway } from "@/lib/takeaways";

/** First day loaded: the five prior years the norm needs, plus the current year. */
function historyStart(year: number): string {
  return `${year - 5}-01-01T00:00:00Z`;
}

interface ComputedSeasonalCardProps {
  ctx: PageContext;
  /** Daily series combined day by day (a day counts only if every series has it). */
  codes: string[];
  combine: (values: number[]) => number;
  title: string;
  subject: string;
  method: React.ReactNode;
  source: string;
  /** Display unit of the combined value (after `combine`, which converts if needed). */
  unit: string;
  commodity: Commodity;
  decimals: number;
  height: number;
  plural?: boolean;
  yMax?: number;
  /** "absolute": gap to the norm in the unit (°C, flows crossing zero); default: percentage. */
  compare?: "percent" | "absolute";
}

/**
 * A series computed on the site from daily stored series (sum, difference, weighted mean), against
 * the same calendar day of the five prior years (lib/seasonal, same rules as web.seasonal_daily).
 */
export async function ComputedSeasonalCard({
  ctx,
  codes,
  combine,
  title,
  subject,
  method,
  source,
  unit,
  commodity,
  decimals,
  height,
  plural = false,
  yMax,
  compare = "percent",
}: ComputedSeasonalCardProps) {
  const loaded = await attempt(subject, getPointsMany(codes, historyStart(ctx.year)));
  const points = loaded
    ? combineDaily(
        codes.map((c) => loaded.get(c) ?? []),
        combine,
      )
    : null;
  const rows = points ? seasonalFromDaily(points, ctx.year) : null;
  const lastRow = rows?.findLast((r) => r.current !== null);
  const comparison = lastRow ? compareWithSeason(lastRow) : null;
  const lastPoint = points?.at(-1);
  const status =
    rows === null ? "error" : rows.every((r) => r.current === null) ? "empty" : "ready";

  return (
    <ChartCard
      title={title}
      takeaway={
        comparison && lastPoint && lastPoint[0].startsWith(String(ctx.year))
          ? compare === "absolute"
            ? seasonalAbsoluteTakeaway(
                subject,
                lastPoint[0],
                comparison,
                unit,
                decimals,
                ctx.rangeLabel,
              )
            : seasonalLevelTakeaway(
                subject,
                lastPoint[0],
                comparison,
                unit,
                decimals,
                ctx.rangeLabel,
                "date",
                plural,
              )
          : undefined
      }
      method={method}
      info={{
        ...chartInfo(seriesOf(ctx, ...codes), ctx.extractionDates, ctx.now, { source, unit }),
        // The card shows a computed value: its unit, not the stored series' unit.
        unit,
      }}
      status={status}
      height={height}
    >
      {rows && (
        <SeasonalChart
          commodity={commodity}
          periods={rows.map((r) => r.day)}
          dailyAxis
          min={rows.map((r) => r.min)}
          max={rows.map((r) => r.max)}
          average={rows.map((r) => r.mean)}
          current={rows.map((r) => r.current)}
          currentLabel={String(ctx.year)}
          rangeLabel={ctx.rangeLabel}
          unit={unit}
          decimals={decimals}
          yMax={yMax}
          height={height}
          ariaLabel={`${subject} by day in ${ctx.year} against the ${ctx.rangeLabel} range and average`}
        />
      )}
    </ChartCard>
  );
}
