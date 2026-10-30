import { ChartCard } from "@/components/chart-card";
import { CurveChart } from "@/components/charts/curve-chart";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DataGapNotice } from "@/components/data-gap-notice";
import { KpiCard } from "@/components/kpi-card";
import { CotPanel } from "@/components/markets/cot-panel";
import { LinesCard } from "@/components/markets/lines-card";
import { WeeklySeasonalCard } from "@/components/markets/weekly-seasonal-card";
import {
  changeFromPrevious,
  changeOverDays,
  compareWithSeason,
  latest,
  percentileRank,
} from "@/lib/analytics";
import { chartInfo } from "@/lib/data/chart-info";
import { DECLARED_GAPS } from "@/lib/data/declared-gaps";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints, getSeasonalWeekly, type Points } from "@/lib/data/series";
import { displayUnit } from "@/lib/display-units";
import { formatChange, formatDate, formatPercentile } from "@/lib/format";
import {
  CURVE_LOOKBACK_DAYS,
  curveRelativeToFront,
  dateOnOrBefore,
  isoDaysBefore,
} from "@/lib/oil";
import { differenceOnDates } from "@/lib/points";
import {
  balanceTakeaway,
  curveTakeaway,
  latestLevelTakeaway,
  spreadTakeaway,
} from "@/lib/takeaways";

const MAIN_HEIGHT = 320;
const CHART_HEIGHT = 280;
const YEAR_DAYS = 366;
const TENORS = Array.from({ length: 12 }, (_, i) => `M${i + 1}`);

const SPOT_CAVEAT = (
  <>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      EIA publishes daily spot prices once a week, so the latest value is often several days old.
      EIA sources these assessments from Refinitiv (LSEG). Brent is FOB North Sea (Dated-type
      physical crude), WTI is FOB Cushing, Oklahoma.
    </p>
  </>
);

const UNOFFICIAL_CURVE_METHOD = (
  <>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      Each point is the settlement of the contract n months out minus the front month (M1), same
      trading day. M1 follows each contract&apos;s exchange expiry rule. A line going down from M1
      means backwardation: prompt barrels are dearer than later ones, a sign of a tight market.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      Unofficial data (Yahoo Finance), NYMEX contracts: WTI (CL) and Brent Last Day Financial (BZ),
      a look-alike settled on ICE Brent, not ICE Brent itself. Only spreads are shown, no futures
      prices (ADR 0003). History started in October 2026 and grows daily; a week- or month-earlier
      curve appears once stored.
    </p>
  </>
);

// KPIs ---------------------------------------------------------------------------------------------

export async function CrudeKpis({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, YEAR_DAYS);
  const [brent, front, spread, stocks, seasonal] = await Promise.all([
    attempt("Brent spot", getPoints("eia.brent_spot", from)),
    attempt("Brent front", getPoints("yahoo.bz.front_month", from)),
    attempt("Brent M1-M2", getPoints("yahoo.bz.m1_m2", from)),
    attempt("US crude stocks", getPoints("eia.us_crude_stocks", daysAgo(ctx.now, 30))),
    attempt("US crude seasonal", getSeasonalWeekly("eia.us_crude_stocks", ctx.year)),
  ]);
  const brentNow = brent && latest(brent);
  const frontNow = front && latest(front);
  const spreadNow = spread && latest(spread);
  const stocksNow = stocks && latest(stocks);
  const stocksRow = seasonal?.findLast((r) => r.current !== null);
  const stocksVsNorm = stocksRow ? compareWithSeason(stocksRow) : null;
  const stocksUnit = displayUnit("kb");
  const stocksWeekChange = stocks && changeFromPrevious(stocks);

  return (
    <>
      <KpiCard
        commodity="crude"
        label="Brent spot (EIA)"
        value={brentNow?.value ?? null}
        unit="$/bbl"
        asOf={brentNow?.ts}
        change={{ value: brent && changeOverDays(brent, 7), label: "vs a week earlier" }}
        context={
          brentNow && brent
            ? [
                {
                  label: "1-year percentile",
                  value: formatPercentile(
                    percentileRank(
                      brentNow.value,
                      brent.map(([, v]) => v),
                    ),
                  ),
                },
              ]
            : []
        }
      />
      <KpiCard
        commodity="crude"
        label="Brent front month (NYMEX BZ)"
        value={frontNow?.value ?? null}
        unit="$/bbl"
        asOf={frontNow?.ts}
        change={{ value: front && changeFromPrevious(front), label: "vs previous close" }}
        unofficial
      />
      <KpiCard
        commodity="crude"
        label="US commercial crude stocks"
        value={stocksNow ? stocksNow.value * stocksUnit.factor : null}
        unit={stocksUnit.unit}
        decimals={1}
        asOf={stocksNow?.ts}
        change={{
          value: stocksWeekChange === null ? null : stocksWeekChange * stocksUnit.factor,
          label: "vs previous week",
        }}
        context={
          stocksVsNorm
            ? [
                {
                  label: `vs ${ctx.rangeLabel} avg`,
                  value: `${formatChange((stocksVsNorm.deviation / stocksVsNorm.mean) * 100, 1)}%`,
                },
              ]
            : []
        }
      />
      <KpiCard
        commodity="crude"
        label="Brent M1–M2 (NYMEX BZ)"
        value={spreadNow?.value ?? null}
        unit="$/bbl"
        asOf={spreadNow?.ts}
        change={{ value: spread && changeFromPrevious(spread), label: "vs previous close" }}
        unofficial
      />
    </>
  );
}

// Main chart -------------------------------------------------------------------------------------

export async function MainPriceChart({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, 3 * 365);
  const [brent, wti] = await Promise.all([
    attempt("Brent spot", getPoints("eia.brent_spot", from)),
    attempt("WTI spot", getPoints("eia.wti_spot", from)),
  ]);
  const meta = seriesOf(ctx, "eia.brent_spot", "eia.wti_spot");
  const brentNow = brent && latest(brent);
  const status =
    brent === null || wti === null
      ? "error"
      : brent.length === 0 && wti.length === 0
        ? "empty"
        : "ready";

  return (
    <ChartCard
      title="Where are crude prices?"
      takeaway={
        brentNow
          ? latestLevelTakeaway("Brent spot", brentNow.value, "$/bbl", 2, brentNow.ts)
          : undefined
      }
      method={
        <>
          <p className="font-medium text-foreground">What it shows</p>
          <p>
            Daily spot assessments of the two crude benchmarks, as published by EIA: Brent for
            seaborne crude priced in Europe, WTI for US inland crude delivered at Cushing.
          </p>
          {SPOT_CAVEAT}
        </>
      }
      info={chartInfo(meta, ctx.extractionDates, ctx.now, { source: "EIA", unit: "$/bbl" })}
      status={status}
      height={MAIN_HEIGHT}
    >
      <MultiLineChart
        series={[
          { name: "Brent", data: brent ?? [], colorIndex: 0 },
          { name: "WTI", data: wti ?? [], colorIndex: 1 },
        ]}
        unit="$/bbl"
        decimals={2}
        height={MAIN_HEIGHT}
        ariaLabel="Brent and WTI daily spot prices over three years"
      />
    </ChartCard>
  );
}

// Prices & curve ---------------------------------------------------------------------------------

async function CurveCard({
  ctx,
  root,
  market,
}: {
  ctx: PageContext;
  root: "bz" | "cl";
  market: string;
}) {
  const codes = TENORS.slice(1).map((m) => `yahoo.${root}.m1_${m.toLowerCase()}`);
  const spreads = await Promise.all(
    codes.map((c) => attempt(c, getPoints(c, daysAgo(ctx.now, 60)))),
  );
  const failed = spreads.some((s) => s === null);
  const loaded = spreads.map((s) => s ?? []);
  const front = loaded[0];
  const last = front.at(-1)?.[0];
  const targets = last
    ? [
        { label: "Latest", date: last },
        {
          label: "A week earlier",
          date: dateOnOrBefore(front, isoDaysBefore(last, 7), CURVE_LOOKBACK_DAYS),
        },
        {
          label: "A month earlier",
          date: dateOnOrBefore(front, isoDaysBefore(last, 30), CURVE_LOOKBACK_DAYS),
        },
      ]
    : [];
  const lines = targets.flatMap((t, i) => {
    const values = t.date ? curveRelativeToFront(loaded, t.date) : null;
    return values && t.date
      ? [{ name: `${formatDate(t.date)} (${t.label.toLowerCase()})`, values, colorIndex: i }]
      : [];
  });
  const m2 = latest(front);
  const m12 = latest(loaded[loaded.length - 1]);
  const meta = seriesOf(ctx, ...codes);

  return (
    <ChartCard
      title={`What shape is the ${market} curve?`}
      takeaway={
        m2
          ? curveTakeaway(
              market,
              m2.ts,
              m2.value,
              "$/bbl",
              m12 && m12.ts === m2.ts ? m12.value : null,
            )
          : undefined
      }
      method={UNOFFICIAL_CURVE_METHOD}
      info={chartInfo(meta, ctx.extractionDates, ctx.now, {
        source: "Yahoo Finance",
        unit: "$/bbl",
        unofficial: true,
      })}
      status={failed ? "error" : lines.length === 0 ? "empty" : "ready"}
      height={CHART_HEIGHT}
    >
      <CurveChart
        tenors={TENORS}
        series={lines}
        unit="$/bbl"
        decimals={2}
        height={CHART_HEIGHT}
        ariaLabel={`${market} futures curve relative to the front month, latest and earlier dates`}
      />
    </ChartCard>
  );
}

export async function PricesTab({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, 3 * 365);
  const [brent, wti] = await Promise.all([
    attempt("Brent spot", getPoints("eia.brent_spot", from)),
    attempt("WTI spot", getPoints("eia.wti_spot", from)),
  ]);
  const spread: Points | null = brent && wti ? differenceOnDates(brent, wti) : null;
  const spreadNow = spread && latest(spread);

  return (
    <div className="grid gap-4">
      <ChartCard
        title="How wide is the Brent–WTI spread?"
        takeaway={
          spreadNow
            ? spreadTakeaway("Brent", "WTI", spreadNow.value, "$/bbl", 2, spreadNow.ts)
            : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">How it is computed</p>
            <p>
              Brent spot minus WTI spot on each date both were assessed (both EIA spot prices, same
              price type). The spread reflects the cost of moving US crude to export markets and the
              relative tightness of the Atlantic Basin and US inland markets.
            </p>
            {SPOT_CAVEAT}
          </>
        }
        info={chartInfo(
          seriesOf(ctx, "eia.brent_spot", "eia.wti_spot"),
          ctx.extractionDates,
          ctx.now,
          {
            source: "EIA",
            unit: "$/bbl",
          },
        )}
        status={spread === null ? "error" : spread.length === 0 ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {spread && (
          <TimeSeriesChart
            name="Brent − WTI"
            commodity="crude"
            data={spread}
            unit="$/bbl"
            decimals={2}
            height={CHART_HEIGHT}
            ariaLabel="Brent minus WTI spot spread, daily, three years"
          />
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <CurveCard ctx={ctx} root="bz" market="Brent (NYMEX BZ)" />
        <CurveCard ctx={ctx} root="cl" market="WTI (NYMEX CL)" />
      </div>

      <LinesCard
        ctx={ctx}
        title="How has the prompt spread moved?"
        method={UNOFFICIAL_CURVE_METHOD}
        source="Yahoo Finance"
        unofficial
        lines={[
          { code: "yahoo.bz.m1_m2", name: "Brent (BZ) M1–M2", colorIndex: 0 },
          { code: "yahoo.cl.m1_m2", name: "WTI (CL) M1–M2", colorIndex: 1 },
          { code: "yahoo.bz.m1_m12", name: "Brent (BZ) M1–M12", colorIndex: 2 },
          { code: "yahoo.cl.m1_m12", name: "WTI (CL) M1–M12", colorIndex: 3 },
        ]}
        days={YEAR_DAYS}
        decimals={2}
        height={CHART_HEIGHT}
        ariaLabel="Brent and WTI futures calendar spreads, daily"
      />
    </div>
  );
}

// Balance & stocks -------------------------------------------------------------------------------

const STEO_METHOD = (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>
      EIA Short-Term Energy Outlook estimates of world liquids supply and demand, and OPEC crude
      production and capacity, by month. Spare capacity is what OPEC could bring online within 30
      days and sustain for 90 days.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      These are EIA estimates, revised in each monthly STEO; the latest months move most. EIA&apos;s
      forecast months are not shown: only months before the current one are stored.
    </p>
  </>
);

export function BalanceTab({ ctx }: { ctx: PageContext }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklySeasonalCard
          ctx={ctx}
          code="eia.us_crude_stocks"
          title="Are US crude stocks tight for the season?"
          subject="US commercial crude stocks"
          plural
          commodity="crude"
          decimals={1}
          height={CHART_HEIGHT}
          caveat="Excludes the Strategic Petroleum Reserve."
        />
        <WeeklySeasonalCard
          ctx={ctx}
          code="eia.cushing_crude_stocks"
          title="Is Cushing, the WTI delivery hub, running low?"
          subject="Cushing crude stocks"
          plural
          commodity="crude"
          decimals={1}
          height={CHART_HEIGHT}
          caveat="Very low Cushing stocks tend to tighten the WTI front-month spread."
        />
        <WeeklySeasonalCard
          ctx={ctx}
          code="eia.us_refinery_utilisation"
          title="How hard are US refineries running?"
          subject="US refinery utilisation"
          commodity="crude"
          decimals={1}
          height={CHART_HEIGHT}
        />
        <LinesCard
          ctx={ctx}
          title="What is in the Strategic Petroleum Reserve?"
          method={
            <>
              <p className="font-medium text-foreground">What it shows</p>
              <p>
                US government crude stocks in the SPR. Changes follow policy (sales, purchases,
                exchanges), not the season, so no seasonal norm is drawn.
              </p>
            </>
          }
          source="EIA"
          lines={[{ code: "eia.spr_crude_stocks", name: "SPR", colorIndex: 0 }]}
          days={10 * 365}
          decimals={1}
          height={CHART_HEIGHT}
          ariaLabel="US Strategic Petroleum Reserve crude stocks, weekly, ten years"
        />
      </div>

      <LinesCard
        ctx={ctx}
        title="How much crude is the US producing?"
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>US field production of crude oil, EIA weekly estimate.</p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>
              The weekly figure is a model-based estimate rounded by EIA and often moves in steps;
              the monthly survey data (PSM) are the reference.
            </p>
          </>
        }
        source="EIA"
        lines={[{ code: "eia.us_crude_production", name: "US crude production", colorIndex: 0 }]}
        days={5 * 365}
        decimals={0}
        height={CHART_HEIGHT}
        ariaLabel="US crude oil field production, weekly, five years"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <LinesCard
          ctx={ctx}
          title="Is the world oil market in surplus or deficit?"
          method={STEO_METHOD}
          source="EIA"
          lines={[
            { code: "eia.world_liquids_production", name: "World production", colorIndex: 0 },
            { code: "eia.world_liquids_consumption", name: "World consumption", colorIndex: 1 },
          ]}
          days={6 * 365}
          decimals={1}
          height={CHART_HEIGHT}
          ariaLabel="World liquids production and consumption, monthly EIA estimates"
          takeaway={([production, consumption]) => {
            const p = latest(production);
            const c = latest(consumption);
            return p && c && p.ts === c.ts ? balanceTakeaway(p.ts, p.value, c.value) : undefined;
          }}
        />
        <LinesCard
          ctx={ctx}
          title="How much spare capacity does OPEC have?"
          method={STEO_METHOD}
          source="EIA"
          lines={[
            { code: "eia.opec_crude_capacity", name: "OPEC capacity", colorIndex: 2 },
            { code: "eia.opec_crude_production", name: "OPEC production", colorIndex: 0 },
            { code: "eia.opec_spare_capacity", name: "Spare capacity", colorIndex: 1 },
          ]}
          days={6 * 365}
          decimals={2}
          height={CHART_HEIGHT}
          ariaLabel="OPEC crude production, capacity and spare capacity, monthly EIA estimates"
          takeaway={([, , spare]) => {
            const s = latest(spare);
            return s
              ? latestLevelTakeaway(
                  "EIA's estimate of OPEC spare capacity",
                  s.value,
                  "mb/d",
                  2,
                  s.ts,
                )
              : undefined;
          }}
        />
      </div>
    </div>
  );
}

// Flows ------------------------------------------------------------------------------------------

export function FlowsTab({ ctx }: { ctx: PageContext }) {
  return (
    <div className="grid gap-4">
      <LinesCard
        ctx={ctx}
        title="Is the US importing or exporting more crude?"
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              US crude imports, exports and net imports (as published by EIA: imports minus
              exports), weekly estimates.
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>
              Weekly trade figures are noisy (cargo timing); monthly data from customs records
              replace them later.
            </p>
          </>
        }
        source="EIA"
        lines={[
          { code: "eia.us_crude_imports", name: "Imports", colorIndex: 0 },
          { code: "eia.us_crude_exports", name: "Exports", colorIndex: 1 },
          { code: "eia.us_crude_net_imports", name: "Net imports", colorIndex: 2 },
        ]}
        days={3 * 365}
        decimals={0}
        height={MAIN_HEIGHT}
        ariaLabel="US crude oil imports, exports and net imports, weekly, three years"
        takeaway={([, exports]) => {
          const e = latest(exports);
          return e ? latestLevelTakeaway("US crude exports", e.value, "kb/d", 0, e.ts) : undefined;
        }}
      />
      <DataGapNotice
        title="Seaborne flows and chokepoints (Hormuz, Bab el-Mandeb, Suez) are not shown yet"
        reason="Tanker tracking data is licensed. Chokepoint transits from open AIS-derived sources are planned for the freight and shipping phase."
      />
    </div>
  );
}

// Positioning and gaps ---------------------------------------------------------------------------

export function PositioningTab({ ctx }: { ctx: PageContext }) {
  return (
    <div className="grid gap-4">
      <CotPanel
        ctx={ctx}
        market={{ key: "wti", name: "WTI", contract: "NYMEX WTI crude oil", commodity: "crude" }}
      />
      <DataGapNotice
        title="Brent positioning is not shown"
        reason="ICE publishes Commitments of Traders for ICE Brent, but its terms forbid republication without written permission. The CFTC report covers the NYMEX Brent look-alike, whose open interest is too small to represent the Brent market."
      />
    </div>
  );
}

export function GapsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DECLARED_GAPS.filter((g) => g.markets.includes("crude")).map((gap) => (
        <DataGapNotice key={gap.title} title={gap.title} reason={gap.reason} />
      ))}
    </div>
  );
}
