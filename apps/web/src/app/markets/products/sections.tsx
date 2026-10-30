import Link from "next/link";

import { ChartCard } from "@/components/chart-card";
import { BarChart } from "@/components/charts/bar-chart";
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
import { getPoints, getSeasonalWeekly } from "@/lib/data/series";
import { displayUnit } from "@/lib/display-units";
import { formatChange, formatNumber, formatPercentile } from "@/lib/format";
import { type PumpPrice, pumpPrice } from "@/lib/oil";
import { latestLevelTakeaway, pumpPriceTakeaway } from "@/lib/takeaways";
import { cn } from "@/lib/utils";

import { AVERAGES, BULLETIN_AREAS, type Fuel, FUELS, productsHref } from "./data";

const MAIN_HEIGHT = 320;
const CHART_HEIGHT = 280;
const YEAR_DAYS = 366;
const BAR_ROW_HEIGHT = 18;
const CRACK_PERCENTILE_YEARS = 5;

const SPOT_CAVEAT = (
  <>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      EIA publishes daily spot prices once a week, so the latest value is often several days old.
      EIA sources these assessments from Refinitiv (LSEG).
    </p>
  </>
);

const CRACK_METHOD = (
  <>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      3-2-1 crack: (2 × US Gulf Coast gasoline + 1 × US Gulf Coast ULSD) ÷ 3, converted from $/gal
      at 42 gallons per barrel, minus WTI Cushing. Diesel crack: New York Harbor ULSD minus Brent.
      Every component is an EIA spot price of the same date; a date missing any component has no
      value.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      A gauge of refining margins, not any refinery&apos;s actual margin (yields, crude slates and
      costs differ). Gulf Coast products against Cushing WTI mixes locations, as the standard US
      crack does. EIA spot prices are published weekly.
    </p>
  </>
);

const STRUCTURE_METHOD = (
  <>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      Front-month settlement minus the second (M1–M2) and sixth (M1–M6) month, same trading day,
      NYMEX NY Harbor ULSD (HO) and RBOB gasoline (RB). M1 follows each contract&apos;s expiry rule.
      Positive means backwardation.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      Unofficial data (Yahoo Finance); only spreads are shown, no futures prices (ADR 0003). History
      started in October 2026 and grows daily. Gasoline spreads swing with the summer and winter
      grade switch.
    </p>
  </>
);

// KPIs ---------------------------------------------------------------------------------------------

export async function ProductsKpis({ ctx }: { ctx: PageContext }) {
  const [crack, distillate, seasonal, euWith, euBefore, hoSpread] = await Promise.all([
    attempt(
      "3-2-1 crack",
      getPoints("eia.crack_321_usgc", daysAgo(ctx.now, CRACK_PERCENTILE_YEARS * 365)),
    ),
    attempt("US distillate stocks", getPoints("eia.us_distillate_stocks", daysAgo(ctx.now, 30))),
    attempt("US distillate seasonal", getSeasonalWeekly("eia.us_distillate_stocks", ctx.year)),
    attempt("EU diesel", getPoints("ec_wob.eu.diesel.with_tax", daysAgo(ctx.now, 30))),
    attempt("EU diesel before tax", getPoints("ec_wob.eu.diesel.wo_tax", daysAgo(ctx.now, 30))),
    attempt("HO M1-M2", getPoints("yahoo.ho.m1_m2", daysAgo(ctx.now, YEAR_DAYS))),
  ]);
  const crackNow = crack && latest(crack);
  const stocksNow = distillate && latest(distillate);
  const stocksRow = seasonal?.findLast((r) => r.current !== null);
  const stocksVsNorm = stocksRow ? compareWithSeason(stocksRow) : null;
  const stocksUnit = displayUnit("kb");
  const stocksWeekChange = distillate && changeFromPrevious(distillate);
  const eu = euWith && euBefore ? pumpPrice("EU", euWith, euBefore) : null;
  const pump = displayUnit("€/1000 L");
  const euChange = euWith && changeOverDays(euWith, 7);
  const hoNow = hoSpread && latest(hoSpread);

  return (
    <>
      <KpiCard
        commodity="products"
        label="US Gulf Coast 3-2-1 crack"
        value={crackNow?.value ?? null}
        unit="$/bbl"
        asOf={crackNow?.ts}
        change={{ value: crack && changeOverDays(crack, 7), label: "vs a week earlier" }}
        context={
          crackNow && crack
            ? [
                {
                  label: `${CRACK_PERCENTILE_YEARS}-year percentile`,
                  value: formatPercentile(
                    percentileRank(
                      crackNow.value,
                      crack.map(([, v]) => v),
                    ),
                  ),
                },
              ]
            : []
        }
      />
      <KpiCard
        commodity="products"
        label="US distillate stocks"
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
        commodity="products"
        label="EU-average diesel pump price"
        value={eu ? eu.withTax * pump.factor : null}
        unit={pump.unit}
        decimals={3}
        asOf={eu?.date}
        change={{
          value: euChange === null ? null : euChange * pump.factor,
          label: "vs a week earlier",
        }}
        context={
          eu ? [{ label: "duties and taxes", value: `${formatNumber(eu.taxShare, 0)}%` }] : []
        }
      />
      <KpiCard
        commodity="products"
        label="NY Harbor ULSD M1–M2 (NYMEX HO)"
        value={hoNow?.value ?? null}
        unit="$/gal"
        decimals={4}
        asOf={hoNow?.ts}
        change={{ value: hoSpread && changeFromPrevious(hoSpread), label: "vs previous close" }}
        unofficial
      />
    </>
  );
}

// Main chart -------------------------------------------------------------------------------------

export function MainCrackChart({ ctx }: { ctx: PageContext }) {
  return (
    <LinesCard
      ctx={ctx}
      title="How profitable is refining?"
      method={CRACK_METHOD}
      source="EIA"
      lines={[
        { code: "eia.crack_321_usgc", name: "US Gulf Coast 3-2-1 (vs WTI)", colorIndex: 0 },
        { code: "eia.crack_ulsd_nyh_brent", name: "NY Harbor diesel (vs Brent)", colorIndex: 1 },
      ]}
      days={3 * 365}
      decimals={2}
      height={MAIN_HEIGHT}
      ariaLabel="US refining crack spreads from EIA spot prices, daily, three years"
      takeaway={([crack]) => {
        const c = latest(crack);
        return c
          ? latestLevelTakeaway("The US Gulf Coast 3-2-1 crack", c.value, "$/bbl", 2, c.ts)
          : undefined;
      }}
    />
  );
}

// Prices & curve ---------------------------------------------------------------------------------

async function PumpPrices({ ctx, fuel }: { ctx: PageContext; fuel: Fuel }) {
  const from = daysAgo(ctx.now, 45);
  const code = (area: string, kind: string) => `ec_wob.${area}.${fuel.product}.${kind}`;
  const loaded = await Promise.all(
    BULLETIN_AREAS.map(async (area) => {
      const [withTax, beforeTax] = await Promise.all([
        attempt(code(area, "with_tax"), getPoints(code(area, "with_tax"), from)),
        attempt(code(area, "wo_tax"), getPoints(code(area, "wo_tax"), from)),
      ]);
      const name = ctx.series.get(code(area, "with_tax"))?.region ?? area.toUpperCase();
      return {
        area,
        failed: withTax === null || beforeTax === null,
        price: withTax && beforeTax ? pumpPrice(name, withTax, beforeTax) : null,
      };
    }),
  );
  const eu = loaded.find((l) => l.area === "eu")?.price ?? null;
  // Only areas priced in the same bulletin as the EU average are compared.
  const sameBulletin = loaded.filter(
    (l): l is typeof l & { price: PumpPrice } => l.price !== null && l.price.date === eu?.date,
  );
  const countries = sameBulletin
    .filter((l) => !AVERAGES.has(l.area))
    .sort((a, b) => b.price.withTax - a.price.withTax);
  const averages = sameBulletin.filter((l) => AVERAGES.has(l.area));
  const rows = [...averages, ...countries];
  const missing = BULLETIN_AREAS.length - sameBulletin.length;
  const { unit, factor } = displayUnit("€/1000 L");
  const meta = seriesOf(
    ctx,
    ...BULLETIN_AREAS.flatMap((a) => [code(a, "with_tax"), code(a, "wo_tax")]),
  );
  const toDisplay = (p: PumpPrice) => ({ area: p.area, withTax: p.withTax * factor });
  const status = loaded.every((l) => l.failed) ? "error" : rows.length === 0 ? "empty" : "ready";
  const height = Math.max(CHART_HEIGHT, rows.length * BAR_ROW_HEIGHT + 48);

  return (
    <div className="grid gap-4">
      <nav aria-label="Fuel" className="flex flex-wrap gap-1.5">
        {FUELS.map((f) => (
          <Link
            key={f.id}
            href={productsHref("prices", f.id)}
            scroll={false}
            aria-current={f.id === fuel.id ? "true" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-muted",
              f.id === fuel.id && "border-primary bg-muted font-medium",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <ChartCard
        title={`What does ${fuel.noun} cost at the pump across the EU?`}
        takeaway={
          eu
            ? pumpPriceTakeaway(
                fuel.noun,
                { withTax: eu.withTax * factor, taxShare: eu.taxShare, date: eu.date },
                countries[0] ? toDisplay(countries[0].price) : null,
                countries.at(-1) ? toDisplay(countries[countries.length - 1].price) : null,
              ) +
              (missing > 0
                ? ` ${missing} area${missing > 1 ? "s" : ""} had no price in that bulletin.`
                : "")
            : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">How it is computed</p>
            <p>
              Consumer prices reported by member states to the European Commission for the latest
              Weekly Oil Bulletin (prices in force on that Monday). Taxes = price including duties
              and taxes minus price before taxes, both from the same bulletin. Converted from euros
              per 1,000 litres to euros per litre for display.
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>
              Prices of countries outside the euro area are converted to euros by the Commission.
              Averages are the Commission&apos;s, weighted by consumption. A country with no price
              in the latest bulletin is left out, not estimated.
            </p>
          </>
        }
        info={chartInfo(meta, ctx.extractionDates, ctx.now, {
          source: "European Commission",
          unit,
        })}
        status={status}
        height={height}
      >
        <BarChart
          categories={rows.map((r) => r.price.area)}
          series={[
            {
              name: "Before taxes",
              values: rows.map((r) => r.price.beforeTax * factor),
              colorIndex: 0,
            },
            {
              name: "Duties and taxes",
              values: rows.map((r) => r.price.taxes * factor),
              colorIndex: 1,
            },
          ]}
          unit={unit}
          decimals={3}
          stacked
          height={height}
          ariaLabel={`${fuel.label} pump prices by EU member state, split into price before taxes and taxes`}
        />
      </ChartCard>
      <LinesCard
        ctx={ctx}
        title={`How has the EU-average ${fuel.noun} price moved?`}
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              The Commission&apos;s EU average, weekly, with and without duties and taxes. The gap
              between the lines is the tax component; most of it is a fixed excise per litre, so the
              price before taxes moves more, in relative terms, with crude and refining margins.
            </p>
          </>
        }
        source="European Commission"
        lines={[
          { code: `ec_wob.eu.${fuel.product}.with_tax`, name: "Pump price", colorIndex: 0 },
          { code: `ec_wob.eu.${fuel.product}.wo_tax`, name: "Before taxes", colorIndex: 1 },
        ]}
        days={5 * 365}
        decimals={3}
        height={CHART_HEIGHT}
        ariaLabel={`EU-average ${fuel.noun} price with and without taxes, weekly, five years`}
      />
    </div>
  );
}

export function PricesTab({ ctx, fuel }: { ctx: PageContext; fuel: Fuel }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <LinesCard
          ctx={ctx}
          title="Where are US gasoline prices?"
          method={
            <>
              <p className="font-medium text-foreground">What it shows</p>
              <p>
                Wholesale spot prices in the three main US hubs: New York Harbor and Gulf Coast
                conventional gasoline, Los Angeles reformulated (RBOB) gasoline.
              </p>
              {SPOT_CAVEAT}
            </>
          }
          source="EIA"
          lines={[
            { code: "eia.gasoline_nyh_spot", name: "New York Harbor", colorIndex: 0 },
            { code: "eia.gasoline_usgc_spot", name: "Gulf Coast", colorIndex: 1 },
            { code: "eia.gasoline_la_spot", name: "Los Angeles (RBOB)", colorIndex: 2 },
          ]}
          days={YEAR_DAYS}
          decimals={3}
          height={CHART_HEIGHT}
          ariaLabel="US gasoline spot prices by hub, daily, one year"
        />
        <LinesCard
          ctx={ctx}
          title="Where are US diesel and jet prices?"
          method={
            <>
              <p className="font-medium text-foreground">What it shows</p>
              <p>
                Wholesale spot prices of ultra-low sulfur diesel (New York Harbor, Gulf Coast, Los
                Angeles CARB) and Gulf Coast jet fuel.
              </p>
              {SPOT_CAVEAT}
            </>
          }
          source="EIA"
          lines={[
            { code: "eia.ulsd_nyh_spot", name: "ULSD New York Harbor", colorIndex: 0 },
            { code: "eia.ulsd_usgc_spot", name: "ULSD Gulf Coast", colorIndex: 1 },
            { code: "eia.ulsd_la_spot", name: "CARB diesel Los Angeles", colorIndex: 2 },
            { code: "eia.jet_usgc_spot", name: "Jet fuel Gulf Coast", colorIndex: 3 },
          ]}
          days={YEAR_DAYS}
          decimals={3}
          height={CHART_HEIGHT}
          ariaLabel="US diesel and jet fuel spot prices, daily, one year"
        />
      </div>
      <LinesCard
        ctx={ctx}
        title="Are product futures curves backwardated?"
        method={STRUCTURE_METHOD}
        source="Yahoo Finance"
        unofficial
        lines={[
          { code: "yahoo.ho.m1_m2", name: "ULSD (HO) M1–M2", colorIndex: 0 },
          { code: "yahoo.ho.m1_m6", name: "ULSD (HO) M1–M6", colorIndex: 1 },
          { code: "yahoo.rb.m1_m2", name: "RBOB (RB) M1–M2", colorIndex: 2 },
          { code: "yahoo.rb.m1_m6", name: "RBOB (RB) M1–M6", colorIndex: 3 },
        ]}
        days={YEAR_DAYS}
        decimals={4}
        height={CHART_HEIGHT}
        ariaLabel="NYMEX ULSD and RBOB calendar spreads, daily"
      />
      <PumpPrices ctx={ctx} fuel={fuel} />
    </div>
  );
}

// Balance & stocks -------------------------------------------------------------------------------

export function BalanceTab({ ctx }: { ctx: PageContext }) {
  const demandCaveat =
    "Product supplied is EIA's demand proxy (what leaves primary supply), not measured consumption, and is noisy week to week.";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WeeklySeasonalCard
        ctx={ctx}
        code="eia.us_distillate_stocks"
        title="Are US distillate stocks tight for the season?"
        subject="US distillate stocks"
        plural
        commodity="products"
        decimals={1}
        height={CHART_HEIGHT}
        caveat="Distillate is diesel and heating oil; stocks usually build into autumn for winter."
      />
      <WeeklySeasonalCard
        ctx={ctx}
        code="eia.us_gasoline_stocks"
        title="Are US gasoline stocks tight for the season?"
        subject="US gasoline stocks"
        plural
        commodity="products"
        decimals={1}
        height={CHART_HEIGHT}
        caveat="Gasoline stocks build in winter and draw through the summer driving season."
      />
      <WeeklySeasonalCard
        ctx={ctx}
        code="eia.us_jet_stocks"
        title="Are US jet fuel stocks tight for the season?"
        subject="US jet fuel stocks"
        plural
        commodity="products"
        decimals={1}
        height={CHART_HEIGHT}
      />
      <WeeklySeasonalCard
        ctx={ctx}
        code="eia.us_distillate_supplied"
        title="Is US distillate demand strong for the season?"
        subject="US distillate product supplied"
        commodity="products"
        decimals={0}
        height={CHART_HEIGHT}
        caveat={demandCaveat}
      />
      <WeeklySeasonalCard
        ctx={ctx}
        code="eia.us_gasoline_supplied"
        title="Is US gasoline demand strong for the season?"
        subject="US gasoline product supplied"
        commodity="products"
        decimals={0}
        height={CHART_HEIGHT}
        caveat={demandCaveat}
      />
    </div>
  );
}

// Flows ------------------------------------------------------------------------------------------

export function FlowsTab({ ctx }: { ctx: PageContext }) {
  return (
    <div className="grid gap-4">
      <LinesCard
        ctx={ctx}
        title="How much fuel is the US exporting?"
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              US exports of distillate, motor gasoline and jet fuel, EIA weekly estimates. US Gulf
              Coast diesel exports go mainly to Latin America and Europe.
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>Weekly export estimates are noisy; monthly customs data replace them later.</p>
          </>
        }
        source="EIA"
        lines={[
          { code: "eia.us_distillate_exports", name: "Distillate", colorIndex: 0 },
          { code: "eia.us_gasoline_exports", name: "Motor gasoline", colorIndex: 1 },
          { code: "eia.us_jet_exports", name: "Jet fuel", colorIndex: 2 },
        ]}
        days={3 * 365}
        decimals={0}
        height={MAIN_HEIGHT}
        ariaLabel="US exports of distillate, gasoline and jet fuel, weekly, three years"
        takeaway={([distillate]) => {
          const d = latest(distillate);
          return d
            ? latestLevelTakeaway("US distillate exports", d.value, "kb/d", 0, d.ts)
            : undefined;
        }}
      />
      <DataGapNotice
        title="European product imports and ARA flows are not shown"
        reason="Cargo-level product flows come from licensed ship-tracking services; Eurostat trade data is monthly and is planned for a later phase."
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
        market={{
          key: "ulsd",
          name: "NY Harbor ULSD",
          contract: "NYMEX NY Harbor ULSD",
          commodity: "products",
        }}
      />
      <CotPanel
        ctx={ctx}
        market={{
          key: "rbob",
          name: "RBOB",
          contract: "NYMEX RBOB gasoline",
          commodity: "products",
        }}
      />
      <DataGapNotice
        title="ICE gasoil positioning is not shown"
        reason="ICE publishes Commitments of Traders for ICE Low Sulphur Gasoil, the European diesel benchmark, but its terms forbid republication without written permission."
      />
    </div>
  );
}

export function GapsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DECLARED_GAPS.filter((g) => g.markets.includes("products")).map((gap) => (
        <DataGapNotice key={gap.title} title={gap.title} reason={gap.reason} />
      ))}
    </div>
  );
}
