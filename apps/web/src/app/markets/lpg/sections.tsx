import { DataGapNotice } from "@/components/data-gap-notice";
import { KpiCard } from "@/components/kpi-card";
import { LinesCard } from "@/components/markets/lines-card";
import { WeeklySeasonalCard } from "@/components/markets/weekly-seasonal-card";
import {
  changeFromPrevious,
  changeOverDays,
  compareWithSeason,
  latest,
  percentileRank,
} from "@/lib/analytics";
import { DECLARED_GAPS } from "@/lib/data/declared-gaps";
import { attempt, daysAgo, type PageContext } from "@/lib/data/page-context";
import { getPoints, getSeasonalWeekly } from "@/lib/data/series";
import { displayUnit } from "@/lib/display-units";
import { formatChange, formatPercentile } from "@/lib/format";
import { latestLevelTakeaway } from "@/lib/takeaways";

const MAIN_HEIGHT = 320;
const CHART_HEIGHT = 280;
const RATIO_PERCENTILE_YEARS = 5;

const SPOT_CAVEAT =
  "EIA publishes daily spot prices once a week, so the latest value is often several days old. EIA sources these assessments from Refinitiv (LSEG).";

const RATIO_METHOD = (
  <>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      Mont Belvieu propane spot, converted from $/gal at 42 gallons per barrel, divided by WTI
      Cushing spot, × 100. Both are EIA spot prices of the same date; a date missing either has no
      value, and dates with WTI at or below zero (April 2020) are skipped.
    </p>
    <p className="font-medium text-foreground">How to read it</p>
    <p>
      Propane is mostly a by-product of gas processing and refining, so its supply does not follow
      crude. A low ratio means propane is cheap against crude, often when US stocks are high; a high
      ratio usually comes with winter heating demand or strong export pull.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>{SPOT_CAVEAT}</p>
  </>
);

// KPIs ---------------------------------------------------------------------------------------------

export async function LpgKpis({ ctx }: { ctx: PageContext }) {
  const [spot, ratio, stocks, seasonal, exports] = await Promise.all([
    attempt("propane spot", getPoints("eia.propane_mb_spot", daysAgo(ctx.now, 30))),
    attempt(
      "propane % of WTI",
      getPoints("eia.propane_wti_ratio", daysAgo(ctx.now, RATIO_PERCENTILE_YEARS * 365)),
    ),
    attempt("US propane stocks", getPoints("eia.us_propane_stocks", daysAgo(ctx.now, 30))),
    attempt("US propane seasonal", getSeasonalWeekly("eia.us_propane_stocks", ctx.year)),
    attempt("US propane exports", getPoints("eia.us_propane_exports", daysAgo(ctx.now, 30))),
  ]);
  const spotNow = spot && latest(spot);
  const ratioNow = ratio && latest(ratio);
  const stocksNow = stocks && latest(stocks);
  const stocksRow = seasonal?.findLast((r) => r.current !== null);
  const stocksVsNorm = stocksRow ? compareWithSeason(stocksRow) : null;
  const stocksUnit = displayUnit("kb");
  const stocksWeekChange = stocks && changeFromPrevious(stocks);
  const exportsNow = exports && latest(exports);

  return (
    <>
      <KpiCard
        commodity="lpg"
        label="Propane spot, Mont Belvieu"
        value={spotNow?.value ?? null}
        unit="$/gal"
        decimals={3}
        asOf={spotNow?.ts}
        change={{ value: spot && changeOverDays(spot, 7), label: "vs a week earlier" }}
      />
      <KpiCard
        commodity="lpg"
        label="Propane as % of WTI"
        value={ratioNow?.value ?? null}
        unit="%"
        decimals={1}
        asOf={ratioNow?.ts}
        change={{ value: ratio && changeOverDays(ratio, 7), label: "points vs a week earlier" }}
        context={
          ratioNow && ratio
            ? [
                {
                  label: `${RATIO_PERCENTILE_YEARS}-year percentile`,
                  value: formatPercentile(
                    percentileRank(
                      ratioNow.value,
                      ratio.map(([, v]) => v),
                    ),
                  ),
                },
              ]
            : []
        }
      />
      <KpiCard
        commodity="lpg"
        label="US propane stocks"
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
        commodity="lpg"
        label="US propane exports"
        value={exportsNow?.value ?? null}
        unit="kb/d"
        decimals={0}
        asOf={exportsNow?.ts}
        change={{ value: exports && changeFromPrevious(exports), label: "vs previous week" }}
      />
    </>
  );
}

// Main chart -------------------------------------------------------------------------------------

export function MainRatioChart({ ctx }: { ctx: PageContext }) {
  return (
    <LinesCard
      ctx={ctx}
      title="Is propane cheap or dear against crude?"
      method={RATIO_METHOD}
      source="EIA"
      lines={[{ code: "eia.propane_wti_ratio", name: "Propane as % of WTI", colorIndex: 0 }]}
      days={5 * 365}
      decimals={1}
      height={MAIN_HEIGHT}
      ariaLabel="Mont Belvieu propane spot as a percentage of WTI spot, daily, five years"
      takeaway={([ratio]) => {
        const r = latest(ratio);
        return r ? latestLevelTakeaway("Propane", r.value, "% of WTI", 1, r.ts) : undefined;
      }}
    />
  );
}

// Prices -----------------------------------------------------------------------------------------

export function PricesTab({ ctx }: { ctx: PageContext }) {
  return (
    <LinesCard
      ctx={ctx}
      title="Where is the propane price?"
      method={
        <>
          <p className="font-medium text-foreground">What it shows</p>
          <p>
            Mont Belvieu (Texas) propane spot price FOB, the US Gulf Coast hub and the reference for
            US propane exports. EIA daily series.
          </p>
          <p className="font-medium text-foreground">Caveats</p>
          <p>{SPOT_CAVEAT}</p>
        </>
      }
      source="EIA"
      lines={[{ code: "eia.propane_mb_spot", name: "Propane, Mont Belvieu", colorIndex: 0 }]}
      days={3 * 365}
      decimals={3}
      height={CHART_HEIGHT}
      ariaLabel="Mont Belvieu propane spot price, daily, three years"
      takeaway={([spot]) => {
        const s = latest(spot);
        return s
          ? latestLevelTakeaway("Mont Belvieu propane", s.value, "$/gal", 3, s.ts)
          : undefined;
      }}
    />
  );
}

// Balance & stocks -------------------------------------------------------------------------------

export function BalanceTab({ ctx }: { ctx: PageContext }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WeeklySeasonalCard
        ctx={ctx}
        code="eia.us_propane_stocks"
        title="Are US propane stocks high or low for the season?"
        subject="US propane stocks"
        plural
        commodity="lpg"
        decimals={1}
        height={CHART_HEIGHT}
        caveat="Propane and propylene together, as EIA reports them. Stocks build from spring to October and draw through the heating season."
      />
      <WeeklySeasonalCard
        ctx={ctx}
        code="eia.us_propane_supplied"
        title="Is US propane demand strong for the season?"
        subject="US propane product supplied"
        commodity="lpg"
        decimals={0}
        height={CHART_HEIGHT}
        caveat="Product supplied is EIA's demand proxy (what leaves primary supply), not measured consumption, and is noisy week to week. It peaks with winter heating and crop drying."
      />
    </div>
  );
}

// Flows ------------------------------------------------------------------------------------------

export function FlowsTab({ ctx }: { ctx: PageContext }) {
  return (
    <LinesCard
      ctx={ctx}
      title="How much propane is the US exporting?"
      method={
        <>
          <p className="font-medium text-foreground">What it shows</p>
          <p>
            US propane exports, EIA weekly estimates. The US is the largest LPG exporter; most
            cargoes leave the Gulf Coast for Asia, Latin America and Europe.
          </p>
          <p className="font-medium text-foreground">Caveats</p>
          <p>
            Weekly export figures are estimates and are revised; destinations are not published
            weekly.
          </p>
        </>
      }
      source="EIA"
      lines={[{ code: "eia.us_propane_exports", name: "US propane exports", colorIndex: 0 }]}
      days={3 * 365}
      decimals={0}
      height={CHART_HEIGHT}
      ariaLabel="US propane exports, weekly, three years"
    />
  );
}

// Data gaps --------------------------------------------------------------------------------------

export function GapsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DECLARED_GAPS.filter((g) => g.markets.includes("lpg")).map((gap) => (
        <DataGapNotice key={gap.title} title={gap.title} reason={gap.reason} />
      ))}
    </div>
  );
}
