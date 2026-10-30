import { ChartCard } from "@/components/chart-card";
import { SeasonalChart } from "@/components/charts/seasonal-chart";
import { compareWithSeason, latest } from "@/lib/analytics";
import type { Commodity } from "@/lib/commodities";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints, getSeasonalWeekly } from "@/lib/data/series";
import { displayUnit } from "@/lib/display-units";
import { seasonalLevelTakeaway } from "@/lib/takeaways";

const RECENT_DAYS = 21;

export const WEEKLY_SEASONAL_METHOD = (rangeLabel: string, caveat?: string) => (
  <>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      For each ISO week, the band is the minimum to maximum and the dashed line the mean of the same
      week in {rangeLabel}; the current year is excluded from the norm. Week 53, which only some
      years have, is compared with week 52.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      EIA weekly figures are estimates from the Weekly Petroleum Status Report, published on
      Wednesday for the week ending the previous Friday, and revised later in monthly data.
      {caveat ? ` ${caveat}` : ""}
    </p>
  </>
);

interface WeeklySeasonalCardProps {
  ctx: PageContext;
  code: string;
  title: string;
  /** Subject of the takeaway sentence, e.g. "US commercial crude stocks". */
  subject: string;
  commodity: Commodity;
  decimals: number;
  height: number;
  caveat?: string;
  /** The subject takes a plural verb ("stocks were"). */
  plural?: boolean;
}

/** A weekly series against the same ISO week of the five prior years, in its display unit. */
export async function WeeklySeasonalCard({
  ctx,
  code,
  title,
  subject,
  commodity,
  decimals,
  height,
  caveat,
  plural = false,
}: WeeklySeasonalCardProps) {
  const [rows, recent] = await Promise.all([
    attempt(`${code} seasonal`, getSeasonalWeekly(code, ctx.year)),
    attempt(code, getPoints(code, daysAgo(ctx.now, RECENT_DAYS))),
  ]);
  const meta = seriesOf(ctx, code);
  const { unit, factor } = displayUnit(meta[0]?.unit ?? "");
  const scale = (v: number | null) => (v === null ? null : v * factor);
  const scaled = rows?.map((r) => ({
    ...r,
    min: scale(r.min),
    max: scale(r.max),
    mean: scale(r.mean),
    current: scale(r.current),
  }));
  const lastRow = scaled?.findLast((r) => r.current !== null);
  const comparison = lastRow ? compareWithSeason(lastRow) : null;
  const lastPoint = recent && latest(recent);
  const status =
    rows === null ? "error" : (scaled ?? []).every((r) => r.current === null) ? "empty" : "ready";

  return (
    <ChartCard
      title={title}
      takeaway={
        comparison && lastPoint
          ? seasonalLevelTakeaway(
              subject,
              lastPoint.ts,
              comparison,
              unit,
              decimals,
              ctx.rangeLabel,
              "week",
              plural,
            )
          : undefined
      }
      method={WEEKLY_SEASONAL_METHOD(ctx.rangeLabel, caveat)}
      info={chartInfo(meta, ctx.extractionDates, ctx.now, { source: "EIA", unit })}
      status={status}
      height={height}
    >
      {scaled && (
        <SeasonalChart
          commodity={commodity}
          periods={scaled.map((r) => r.day)}
          weeklyAxis
          min={scaled.map((r) => r.min)}
          max={scaled.map((r) => r.max)}
          average={scaled.map((r) => r.mean)}
          current={scaled.map((r) => r.current)}
          currentLabel={String(ctx.year)}
          rangeLabel={ctx.rangeLabel}
          unit={unit}
          decimals={decimals}
          height={height}
          ariaLabel={`${subject} by week in ${ctx.year} against the ${ctx.rangeLabel} range and average`}
        />
      )}
    </ChartCard>
  );
}
