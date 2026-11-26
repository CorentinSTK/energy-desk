import { ChartCard } from "@/components/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints } from "@/lib/data/series";
import { formatChange, formatDate, formatNumber } from "@/lib/format";

const CODE = "yahoo.carbon.co2_etc";
const HEIGHT = 240;
const DAYS = 2 * 365;

const METHOD = (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>
      The closing price of one unit of the SparkChange Physical Carbon EUA ETC, an exchange-traded
      product listed in London and backed by EU emission allowances (EUAs). It follows the EUA
      price, the cost of emitting one tonne of CO₂ in the EU emissions trading system.
    </p>
    <p className="font-medium text-foreground">Why not the EUA price itself</p>
    <p>
      EUA prices (EEX auctions, ICE Endex futures) may not be republished without a licence, and the
      European Commission publishes none. This product is the closest free proxy. Its unit price is
      not a price per tonne: product fees make it drift from the EUA price over time.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      Unofficial and delayed data from Yahoo Finance, for research only. It is never combined with
      power or gas prices in a spread.
    </p>
  </>
);

export async function CarbonIndicator({ ctx }: { ctx: PageContext }) {
  const points = await attempt("carbon ETC", getPoints(CODE, daysAgo(ctx.now, DAYS)));
  const last = points?.at(-1) ?? null;
  const yearAgo = last
    ? points?.findLast(([ts]) => Date.parse(ts) <= Date.parse(last[0]) - 365 * 86_400_000)
    : undefined;
  const change = last && yearAgo ? ((last[1] - yearAgo[1]) / yearAgo[1]) * 100 : null;
  return (
    <ChartCard
      title="What is carbon worth? (unofficial proxy)"
      takeaway={
        last
          ? `The EUA-backed ETC closed at ${formatNumber(last[1], 2)} € per unit on ${formatDate(last[0])}${
              change === null ? "" : `, ${formatChange(change, 0)}% on a year earlier`
            }.`
          : undefined
      }
      method={METHOD}
      info={chartInfo(seriesOf(ctx, CODE), ctx.extractionDates, ctx.now, {
        source: "Yahoo Finance",
        unit: "€/unit",
        unofficial: true,
      })}
      status={points === null ? "error" : points.length === 0 ? "empty" : "ready"}
      height={HEIGHT}
    >
      {points && (
        <TimeSeriesChart
          name="EUA-backed ETC"
          commodity="power"
          data={points}
          unit="€/unit"
          decimals={2}
          height={HEIGHT}
          ariaLabel="Price of the SparkChange Physical Carbon EUA ETC over two years, unofficial"
        />
      )}
    </ChartCard>
  );
}
