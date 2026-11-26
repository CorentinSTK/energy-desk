import { ChartCard } from "@/components/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPointsMany } from "@/lib/data/series";
import { formatDate, formatNumber } from "@/lib/format";
import { combineDaily } from "@/lib/seasonal";

const STOCKS = "eia.us_crude_stocks";
const RUNS = "eia.us_refinery_crude_input";
const HEIGHT = 260;
const YEARS = 5;

/** Commercial crude stocks divided by refinery crude runs: days refiners could run on stocks. */
export async function DaysOfCover({ ctx }: { ctx: PageContext }) {
  const loaded = await attempt(
    "crude days of cover",
    getPointsMany([STOCKS, RUNS], daysAgo(ctx.now, YEARS * 365)),
  );
  // kb ÷ kb/d = days, for the same EIA report week.
  const points = loaded
    ? combineDaily([loaded.get(STOCKS) ?? [], loaded.get(RUNS) ?? []], ([s, r]) =>
        r > 0 ? s / r : Number.NaN,
      ).filter(([, v]) => Number.isFinite(v))
    : null;
  const last = points?.at(-1);
  const values = points?.map(([, v]) => v) ?? [];
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return (
    <ChartCard
      title="How many days of refinery runs do US crude stocks cover?"
      takeaway={
        last && avg !== null
          ? `In the week to ${formatDate(last[0])}, US commercial crude stocks covered ${formatNumber(last[1], 1)} days of refinery runs, against ${formatNumber(avg, 1)} on average over ${YEARS} years.`
          : undefined
      }
      method={
        <>
          <p className="font-medium text-foreground">How it is computed</p>
          <p>
            Commercial crude stocks (excluding the Strategic Petroleum Reserve) divided by
            refiners&apos; net crude input in the same EIA report week: thousand barrels divided by
            thousand barrels a day gives days. It reads stocks against how fast refiners use crude,
            which a level alone does not.
          </p>
          <p className="font-medium text-foreground">Caveats</p>
          <p>
            Refinery runs swing with maintenance in spring and autumn, so cover rises when
            refineries slow down even if stocks are flat. Weekly EIA estimates, revised later.
          </p>
        </>
      }
      info={{
        ...chartInfo(seriesOf(ctx, STOCKS, RUNS), ctx.extractionDates, ctx.now, {
          source: "EIA",
          unit: "days",
        }),
        unit: "days",
      }}
      status={points === null ? "error" : points.length === 0 ? "empty" : "ready"}
      height={HEIGHT}
    >
      {points && (
        <TimeSeriesChart
          name="Days of cover"
          commodity="crude"
          data={points}
          unit="days"
          decimals={1}
          height={HEIGHT}
          ariaLabel={`US commercial crude stocks in days of refinery runs, weekly, ${YEARS} years`}
        />
      )}
    </ChartCard>
  );
}
