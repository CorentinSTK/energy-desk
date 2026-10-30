import { ChartCard } from "@/components/chart-card";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { latest, percentileRank } from "@/lib/analytics";
import type { Commodity } from "@/lib/commodities";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints } from "@/lib/data/series";
import { netPosition, percentOf } from "@/lib/oil";
import { positioningTakeaway } from "@/lib/takeaways";

const YEARS = 3;
const HEIGHT = 280;

/** Trader categories of the CFTC disaggregated report, with a fixed palette colour each. */
const CATEGORIES = [
  { id: "managed_money", name: "Managed money", color: 0 },
  { id: "producer", name: "Producers and merchants", color: 1 },
  { id: "swap", name: "Swap dealers", color: 2 },
] as const;

export interface CotMarket {
  /** Catalogue key: cftc.<key>.* (worker/catalog/cftc.yaml). */
  key: string;
  /** Short name in sentences, e.g. "WTI". */
  name: string;
  /** Contract name in titles, e.g. "NYMEX WTI crude oil". */
  contract: string;
  commodity: Commodity;
}

const METHOD = (contract: string) => (
  <>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      Net position = long minus short contracts of each trader category, futures only, from the CFTC
      disaggregated Commitments of Traders report for {contract}. The second chart divides the
      managed-money net position by total open interest of the same report.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      Positions are as of Tuesday and published on Friday (later in holiday weeks). Producers and
      merchants hedge physical exposure, so they are usually net short; managed money (funds) is the
      speculative category traders watch. Spread positions are not included in the nets.
    </p>
  </>
);

/** Positioning tab content for one CFTC market: nets by category and managed money vs open interest. */
export async function CotPanel({ ctx, market }: { ctx: PageContext; market: CotMarket }) {
  const from = daysAgo(ctx.now, YEARS * 365);
  const code = (field: string) => `cftc.${market.key}.${field}`;
  const [openInterest, ...legs] = await Promise.all([
    attempt(code("open_interest"), getPoints(code("open_interest"), from)),
    ...CATEGORIES.flatMap((c) => [
      attempt(code(`${c.id}_long`), getPoints(code(`${c.id}_long`), from)),
      attempt(code(`${c.id}_short`), getPoints(code(`${c.id}_short`), from)),
    ]),
  ]);
  const failed = openInterest === null || legs.some((l) => l === null);
  const nets = CATEGORIES.map((c, i) => {
    const long = legs[2 * i];
    const short = legs[2 * i + 1];
    return { ...c, data: long && short ? netPosition(long, short) : [] };
  });
  const managed = nets[0].data;
  const managedShare = openInterest ? percentOf(managed, openInterest) : [];
  const now = latest(managed);
  const shareNow = latest(managedShare);
  const takeaway = now
    ? positioningTakeaway(
        market.name,
        now.ts,
        now.value,
        shareNow?.ts === now.ts ? shareNow.value : null,
        percentileRank(
          now.value,
          managed.map(([, v]) => v),
        ),
        YEARS,
      )
    : undefined;
  const meta = seriesOf(
    ctx,
    code("open_interest"),
    ...CATEGORIES.flatMap((c) => [code(`${c.id}_long`), code(`${c.id}_short`)]),
  );
  const status = failed ? "error" : managed.length === 0 ? "empty" : "ready";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title={`Who is long and who is short ${market.name}?`}
        takeaway={takeaway}
        method={METHOD(market.contract)}
        info={chartInfo(meta, ctx.extractionDates, ctx.now, { source: "CFTC", unit: "contracts" })}
        status={status}
        height={HEIGHT}
      >
        <MultiLineChart
          series={nets.map((n) => ({ name: n.name, data: n.data, colorIndex: n.color }))}
          unit="contracts"
          decimals={0}
          height={HEIGHT}
          ariaLabel={`Net futures positions in ${market.contract} by trader category, weekly, ${YEARS} years`}
        />
      </ChartCard>
      <ChartCard
        title={`How stretched is managed money in ${market.name}?`}
        method={METHOD(market.contract)}
        info={{
          // The catalogue unit is contracts; this chart shows a share of open interest.
          ...chartInfo(meta, ctx.extractionDates, ctx.now, { source: "CFTC", unit: "%" }),
          unit: "%",
        }}
        status={failed ? "error" : managedShare.length === 0 ? "empty" : "ready"}
        height={HEIGHT}
      >
        <TimeSeriesChart
          name="Managed money net, % of open interest"
          commodity={market.commodity}
          data={managedShare}
          unit="%"
          decimals={1}
          height={HEIGHT}
          ariaLabel={`Managed-money net position in ${market.contract} as a share of open interest`}
        />
      </ChartCard>
    </div>
  );
}
