import Link from "next/link";

import { ChartCard } from "@/components/chart-card";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { SeasonalChart } from "@/components/charts/seasonal-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DataGapNotice } from "@/components/data-gap-notice";
import { KpiCard } from "@/components/kpi-card";
import { changeFromPrevious, compareWithSeason, latest, valueDaysBefore } from "@/lib/analytics";
import { chartInfo } from "@/lib/data/chart-info";
import { DECLARED_GAPS } from "@/lib/data/declared-gaps";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints, getSeasonal, type Points, type SeasonalRow } from "@/lib/data/series";
import { displayUnit, rescale } from "@/lib/display-units";
import { formatChange, formatDate, formatNumber } from "@/lib/format";
import { differenceOnDates, shareOnDates, sumOnDates } from "@/lib/power";
import { latestLevelTakeaway, seasonalLevelTakeaway } from "@/lib/takeaways";
import { cn } from "@/lib/utils";

import { FLOWS, type PowerZone, powerHref, type PowerTab, ZONES } from "./data";

const MAIN_HEIGHT = 320;
const CHART_HEIGHT = 280;
const YEAR_DAYS = 366;
const INTRADAY_DAYS = 14;
const GW = displayUnit("MW").unit;
const TIME_ZONES: Record<PowerZone["id"], string> = {
  de: "Europe/Berlin",
  fr: "Europe/Paris",
  gb: "Europe/London",
};

function lastSeasonalDay(rows: SeasonalRow[], year: number): string | null {
  const row = rows.findLast((r) => r.current !== null);
  return row ? `${year}${row.day.slice(4)}T00:00:00Z` : null;
}

function seasonalComparison(rows: SeasonalRow[] | null, year: number) {
  const day = rows && lastSeasonalDay(rows, year);
  const row = day && rows?.find((r) => r.day.slice(5, 10) === day.slice(5, 10));
  return { day, comparison: row ? compareWithSeason(row) : null };
}

/** Seasonal rows with values rescaled for display (MW → GW). */
function scaleRows(rows: SeasonalRow[], factor: number): SeasonalRow[] {
  const s = (v: number | null) => (v === null ? null : v * factor);
  return rows.map((r) => ({
    ...r,
    min: s(r.min),
    max: s(r.max),
    mean: s(r.mean),
    current: s(r.current),
  }));
}

/** Sum of several series per date (see lib/power.ts); null if any query failed. */
async function sumOf(codes: string[], from: string): Promise<Points | null> {
  const parts = await Promise.all(codes.map((c) => attempt(c, getPoints(c, from))));
  if (parts.some((p) => p === null)) return null;
  return sumOnDates(parts as Points[]);
}

/** Generation per group, total, and renewable share, on dates where every group reported. */
async function generationMix(zone: PowerZone, from: string) {
  const groups = await Promise.all(
    zone.mix.groups.map(async (g) => ({ group: g, points: await sumOf(g.codes, from) })),
  );
  if (groups.some((g) => g.points === null)) return null;
  const all = groups.map((g) => g.points as Points);
  const total = sumOnDates(all);
  const renewable = sumOnDates(
    groups.filter((g) => g.group.renewable).map((g) => g.points as Points),
  );
  // Keep every group on the dates the total covers, so the stack never ends on a partial day.
  const dates = new Set(total.map(([ts]) => ts));
  return {
    groups: groups.map((g) => ({
      ...g.group,
      points: (g.points as Points).filter(([ts]) => dates.has(ts)),
    })),
    total,
    share: shareOnDates(renewable, total),
  };
}

function seasonalProps(rows: SeasonalRow[]) {
  return {
    periods: rows.map((r) => r.day),
    dailyAxis: true,
    min: rows.map((r) => r.min),
    max: rows.map((r) => r.max),
    average: rows.map((r) => r.mean),
    current: rows.map((r) => r.current),
  };
}

const SEASONAL_METHOD = (rangeLabel: string, what: string) => (
  <>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      {what} For each calendar day, the band is the minimum to maximum and the dashed line the mean
      of the same day in {rangeLabel}; the current year is excluded from the norm. 29 February is
      left out.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      Days with any missing hour or settlement period are not averaged: they are left out and show
      as gaps.
    </p>
  </>
);

const PRICE_WHAT: Record<PowerZone["id"], string> = {
  de: "The daily base price is the average of the 24 hourly day-ahead prices of the delivery day (Europe/Berlin time).",
  fr: "The daily base price is the average of the 24 hourly day-ahead prices of the delivery day (Europe/Paris time).",
  gb: "The daily value is the average of the 48 half-hourly market index prices of the day (UK time). The Elexon market index is a volume-weighted average of short-term trades, not a day-ahead auction price.",
};

// KPIs ---------------------------------------------------------------------------------------------

export async function PowerKpis({ ctx, zone }: { ctx: PageContext; zone: PowerZone }) {
  const from = daysAgo(ctx.now, 30);
  const [base, baseSeasonal, load, loadSeasonal, mix] = await Promise.all([
    attempt(`${zone.id} base`, getPoints(zone.price.base, from)),
    attempt(`${zone.id} base seasonal`, getSeasonal(zone.price.base, ctx.year)),
    attempt(`${zone.id} load`, getPoints(zone.load.code, from)),
    attempt(`${zone.id} load seasonal`, getSeasonal(zone.load.code, ctx.year)),
    generationMix(zone, from),
  ]);
  const baseNow = base && latest(base);
  const baseRow =
    baseNow && baseSeasonal?.find((r) => r.day.slice(5, 10) === baseNow.ts.slice(5, 10));
  const baseVsSeason = baseRow ? compareWithSeason(baseRow) : null;
  const loadNow = load && latest(rescale(load, "MW"));
  const loadRow =
    loadNow && loadSeasonal?.find((r) => r.day.slice(5, 10) === loadNow.ts.slice(5, 10));
  const loadVsSeason = loadRow ? compareWithSeason(loadRow) : null;
  const shareNow = mix && latest(mix.share);
  const shareWeekAgo = mix && valueDaysBefore(mix.share, 7);

  return (
    <>
      <KpiCard
        commodity="power"
        label={zone.price.name}
        value={baseNow?.value ?? null}
        unit={zone.price.unit}
        asOf={baseNow?.ts}
        change={{ value: base && changeFromPrevious(base), label: "vs previous day" }}
        context={
          baseVsSeason
            ? [
                {
                  label: `vs ${ctx.rangeLabel} avg`,
                  value: `${formatChange(baseVsSeason.deviation, 0)} ${zone.price.unit}`,
                },
              ]
            : []
        }
      />
      <KpiCard
        commodity="power"
        label={zone.load.name}
        value={loadNow?.value ?? null}
        unit={GW}
        decimals={1}
        asOf={loadNow?.ts}
        context={
          loadVsSeason && loadVsSeason.mean !== 0
            ? [
                {
                  label: `vs ${ctx.rangeLabel} avg`,
                  value: `${formatChange((loadVsSeason.deviation / loadVsSeason.mean) * 100, 0)}%`,
                },
              ]
            : []
        }
      />
      <KpiCard
        commodity="power"
        label="Renewable share of generation"
        value={shareNow?.value ?? null}
        unit="%"
        decimals={0}
        asOf={shareNow?.ts}
        change={{
          value: shareNow && shareWeekAgo !== null ? shareNow.value - shareWeekAgo : null,
          label: "pts vs a week earlier",
        }}
      />
      {zone.id === "gb" ? <GbImportsKpi ctx={ctx} /> : <DeFrSpreadKpi ctx={ctx} />}
    </>
  );
}

async function DeFrSpreadKpi({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, 30);
  const [de, fr] = await Promise.all([
    attempt("DE base", getPoints("smard.de_lu.price_da_base", from)),
    attempt("FR base", getPoints("smard.fr.price_da_base", from)),
  ]);
  const spread = de && fr ? differenceOnDates(de, fr) : null;
  const now = spread && latest(spread);
  return (
    <KpiCard
      commodity="power"
      label="DE–FR base spread"
      value={now?.value ?? null}
      unit="€/MWh"
      asOf={now?.ts}
      change={{ value: spread && changeFromPrevious(spread), label: "vs previous day" }}
    />
  );
}

async function GbImportsKpi({ ctx }: { ctx: PageContext }) {
  const codes = FLOWS.gb?.lines.flatMap((l) => l.codes) ?? [];
  const net = await sumOf(codes, daysAgo(ctx.now, 30));
  const now = net && latest(rescale(net, "MW"));
  return (
    <KpiCard
      commodity="power"
      label="GB net interconnector imports"
      value={now?.value ?? null}
      unit={GW}
      decimals={1}
      asOf={now?.ts}
      change={{
        value: net && changeFromPrevious(rescale(net, "MW")),
        label: "vs previous day",
      }}
    />
  );
}

// Main chart -------------------------------------------------------------------------------------

export async function MainPriceChart({ ctx, zone }: { ctx: PageContext; zone: PowerZone }) {
  const rows = await attempt(`${zone.id} base seasonal`, getSeasonal(zone.price.base, ctx.year));
  const { day, comparison } = seasonalComparison(rows, ctx.year);

  return (
    <ChartCard
      title={`Is ${zone.label} power expensive for the season?`}
      takeaway={
        comparison && day
          ? seasonalLevelTakeaway(
              zone.price.name,
              day,
              comparison,
              zone.price.unit,
              0,
              ctx.rangeLabel,
            )
          : undefined
      }
      method={SEASONAL_METHOD(ctx.rangeLabel, PRICE_WHAT[zone.id])}
      info={chartInfo(seriesOf(ctx, zone.price.base), ctx.extractionDates, ctx.now, {
        source: zone.price.source,
        unit: zone.price.unit,
      })}
      status={rows === null ? "error" : rows.every((r) => r.current === null) ? "empty" : "ready"}
      height={MAIN_HEIGHT}
    >
      {rows && (
        <SeasonalChart
          commodity="power"
          {...seasonalProps(rows)}
          currentLabel={String(ctx.year)}
          rangeLabel={ctx.rangeLabel}
          unit={zone.price.unit}
          decimals={0}
          height={MAIN_HEIGHT}
          ariaLabel={`${zone.price.name} in ${ctx.year} against the ${ctx.rangeLabel} range and average`}
        />
      )}
    </ChartCard>
  );
}

// Zone selector ----------------------------------------------------------------------------------

export function ZoneNav({ tab, zone }: { tab: PowerTab; zone: PowerZone }) {
  return (
    <nav aria-label="Power zone" className="flex flex-wrap gap-1.5">
      {ZONES.map((z) => (
        <Link
          key={z.id}
          href={powerHref(tab, z.id)}
          scroll={false}
          aria-current={z.id === zone.id ? "true" : undefined}
          className={cn(
            "rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-muted",
            z.id === zone.id && "border-primary bg-muted font-medium",
          )}
        >
          {z.label}
        </Link>
      ))}
    </nav>
  );
}

// Prices & curve ---------------------------------------------------------------------------------

export async function PricesTab({ ctx, zone }: { ctx: PageContext; zone: PowerZone }) {
  const intraday = await attempt(
    `${zone.id} intraday`,
    getPoints(zone.price.intraday, daysAgo(ctx.now, INTRADAY_DAYS)),
  );
  const intradayNow = intraday && latest(intraday);
  const period = zone.id === "gb" ? "half-hour" : "hour";

  return (
    <div className="grid gap-4">
      <ChartCard
        title={`How did ${zone.label} prices move ${period} by ${period}?`}
        takeaway={
          intraday && intraday.length > 0
            ? intradaySpreadTakeaway(intraday, zone.price.unit, period)
            : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              {zone.id === "gb"
                ? "The Elexon market index for each half-hour settlement period over the last two weeks: a volume-weighted average of short-term trades on EPEX SPOT. Periods without trades have no value."
                : "The day-ahead (SDAC) auction price for each hour over the last two weeks, including tomorrow once the auction has cleared. Since 1 October 2025 the auction clears 15-minute products; SMARD's hourly price is the mean of the four quarter-hours."}
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>Times in the tooltip are local to the market. Negative prices are real values.</p>
          </>
        }
        info={chartInfo(seriesOf(ctx, zone.price.intraday), ctx.extractionDates, ctx.now, {
          source: zone.price.source,
          unit: zone.price.unit,
        })}
        status={intraday === null ? "error" : intraday.length === 0 ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {intraday && (
          <TimeSeriesChart
            name={zone.price.name.replace(" base", "")}
            commodity="power"
            data={intraday}
            unit={zone.price.unit}
            decimals={2}
            height={CHART_HEIGHT}
            timeZone={TIME_ZONES[zone.id]}
            ariaLabel={`${zone.label} power price per ${period} over the last two weeks${
              intradayNow
                ? `, last value ${formatNumber(intradayNow.value, 2)} ${zone.price.unit}`
                : ""
            }`}
          />
        )}
      </ChartCard>

      {zone.id === "gb" ? <GbPriceYear ctx={ctx} zone={zone} /> : <DeFrComparison ctx={ctx} />}

      <DataGapNotice
        title="No forward curve for power"
        reason="Power futures (EEX, ICE Endex, EPEX) are licensed exchange data and are not redistributed. Day-ahead prices are shown instead."
      />
    </div>
  );
}

/** Rule: the range between the cheapest and dearest period over the last 24 hours shown. */
function intradaySpreadTakeaway(points: Points, unit: string, period: string): string {
  const perDay = period === "hour" ? 24 : 48;
  const values = points.slice(-perDay).map(([, v]) => v);
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  return `Over the last 24 hours shown, the price ranged from ${formatNumber(lo, 2)} to ${formatNumber(hi, 2)} ${unit} across the ${period}s: a spread of ${formatNumber(hi - lo, 2)} ${unit}.`;
}

async function DeFrComparison({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, YEAR_DAYS);
  const [de, fr] = await Promise.all([
    attempt("DE base", getPoints("smard.de_lu.price_da_base", from)),
    attempt("FR base", getPoints("smard.fr.price_da_base", from)),
  ]);
  const spread = de && fr ? differenceOnDates(de, fr) : null;
  const now = spread && latest(spread);
  const deNow = de && latest(de);
  const frNow = fr && latest(fr);
  const info = chartInfo(
    seriesOf(ctx, "smard.de_lu.price_da_base", "smard.fr.price_da_base"),
    ctx.extractionDates,
    ctx.now,
    { source: "SMARD", unit: "€/MWh" },
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title="Germany and France day-ahead base prices"
        takeaway={
          deNow && frNow && deNow.ts === frNow.ts
            ? `On ${formatDate(deNow.ts)}, the base price was ${formatNumber(deNow.value, 0)} €/MWh in Germany-Luxembourg and ${formatNumber(frNow.value, 0)} €/MWh in France.`
            : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              Daily base prices (average of the 24 hourly day-ahead prices) for the two zones over
              the last year. Both are results of the same coupled European auction.
            </p>
          </>
        }
        info={info}
        status={
          de === null || fr === null ? "error" : de.length + fr.length === 0 ? "empty" : "ready"
        }
        height={CHART_HEIGHT}
      >
        {de && fr && (
          <MultiLineChart
            series={[
              { name: "Germany-Luxembourg", data: de, colorIndex: 0 },
              { name: "France", data: fr, colorIndex: 4 },
            ]}
            unit="€/MWh"
            decimals={0}
            height={CHART_HEIGHT}
            ariaLabel="Germany-Luxembourg and France day-ahead base prices over the last year"
          />
        )}
      </ChartCard>

      <ChartCard
        title="Is power cheaper in Germany or France?"
        takeaway={
          now
            ? `${latestLevelTakeaway("The Germany minus France base spread", now.value, "€/MWh", 0, now.ts)} ${
                now.value > 0
                  ? "Power was dearer in Germany."
                  : now.value < 0
                    ? "Power was dearer in France."
                    : "The two zones were coupled at the same price."
              }`
            : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">How it is computed</p>
            <p>
              Germany-Luxembourg base minus France base, on days both are published. Both are spot
              auction prices in €/MWh, so the spread compares like with like. A spread of zero means
              the interconnection was not congested over the day.
            </p>
          </>
        }
        info={info}
        status={spread === null ? "error" : spread.length === 0 ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {spread && (
          <TimeSeriesChart
            name="DE–FR spread"
            commodity="power"
            data={spread}
            unit="€/MWh"
            decimals={0}
            height={CHART_HEIGHT}
            ariaLabel="Germany minus France day-ahead base price spread over the last year"
          />
        )}
      </ChartCard>
    </div>
  );
}

async function GbPriceYear({ ctx, zone }: { ctx: PageContext; zone: PowerZone }) {
  const points = await attempt(
    "GB MID base",
    getPoints(zone.price.base, daysAgo(ctx.now, YEAR_DAYS)),
  );
  const now = points && latest(points);
  return (
    <ChartCard
      title="How has the GB market index moved over the year?"
      takeaway={
        now
          ? latestLevelTakeaway("The daily GB market index", now.value, "£/MWh", 0, now.ts)
          : undefined
      }
      method={
        <>
          <p className="font-medium text-foreground">What it shows</p>
          <p>
            The daily average of the Elexon market index. It is an index of traded prices, in
            pounds, and is never put in a spread with continental auction prices (different price
            types and currencies).
          </p>
        </>
      }
      info={chartInfo(seriesOf(ctx, zone.price.base), ctx.extractionDates, ctx.now, {
        source: "Elexon",
        unit: "£/MWh",
      })}
      status={points === null ? "error" : points.length === 0 ? "empty" : "ready"}
      height={CHART_HEIGHT}
    >
      {points && (
        <TimeSeriesChart
          name="GB market index, daily"
          commodity="power"
          data={points}
          unit="£/MWh"
          decimals={0}
          height={CHART_HEIGHT}
          ariaLabel="GB market index, daily average, over the last year"
        />
      )}
    </ChartCard>
  );
}

// Balance & stocks -------------------------------------------------------------------------------

export async function BalanceTab({ ctx, zone }: { ctx: PageContext; zone: PowerZone }) {
  const [loadRows, mix] = await Promise.all([
    attempt(`${zone.id} load seasonal`, getSeasonal(zone.load.code, ctx.year)),
    generationMix(zone, daysAgo(ctx.now, YEAR_DAYS)),
  ]);
  const rows = loadRows && scaleRows(loadRows, displayUnit("MW").factor);
  const { day, comparison } = seasonalComparison(rows, ctx.year);
  const mixCodes = zone.mix.groups.flatMap((g) => g.codes);
  const mixInfo = chartInfo(seriesOf(ctx, ...mixCodes), ctx.extractionDates, ctx.now, {
    source: zone.mix.source,
    unit: GW,
  });
  const shareNow = mix && latest(mix.share);
  const lastTotal = mix && latest(mix.total);

  return (
    <div className="grid gap-4">
      <ChartCard
        title={`Is ${zone.load.name} high for the season?`}
        takeaway={
          comparison && day
            ? seasonalLevelTakeaway(zone.load.name, day, comparison, GW, 1, ctx.rangeLabel)
            : undefined
        }
        method={SEASONAL_METHOD(
          ctx.rangeLabel,
          zone.id === "gb"
            ? "Average power over the day (UK time) of the initial national demand outturn (INDO). It is transmission-metered: demand met by embedded solar and wind is not included."
            : "Average power over the delivery day: the day's energy divided by its hours (23 or 25 on clock-change days).",
        )}
        info={chartInfo(seriesOf(ctx, zone.load.code), ctx.extractionDates, ctx.now, {
          source: zone.load.source,
          unit: GW,
        })}
        status={rows === null ? "error" : rows.every((r) => r.current === null) ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {rows && (
          <SeasonalChart
            commodity="power"
            {...seasonalProps(rows)}
            currentLabel={String(ctx.year)}
            rangeLabel={ctx.rangeLabel}
            unit={GW}
            decimals={1}
            height={CHART_HEIGHT}
            ariaLabel={`${zone.load.name} in ${ctx.year} against the ${ctx.rangeLabel} range and average`}
          />
        )}
      </ChartCard>

      <ChartCard
        title={`What is generating ${zone.label}'s power?`}
        takeaway={
          lastTotal && mix ? mixTakeaway(mix.groups, lastTotal.ts, lastTotal.value) : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              Average generation per day by fuel group, stacked, over the last year. Groups add up
              distinct fuel categories reported by the source; pumped storage is in
              &ldquo;Other&rdquo; because it stores power rather than producing it.
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>
              {zone.id === "gb"
                ? "Transmission-connected generation only: most British solar is connected to distribution networks and is not reported here. The chart ends on the last day every group reported."
                : "The chart ends on the last day every group reported, so a late publication does not look like a fall in generation."}
            </p>
          </>
        }
        info={mixInfo}
        status={mix === null ? "error" : mix.total.length === 0 ? "empty" : "ready"}
        height={MAIN_HEIGHT}
      >
        {mix && (
          <MultiLineChart
            stacked
            series={mix.groups.map((g) => ({
              name: g.name,
              data: rescale(g.points, "MW"),
              colorIndex: g.color,
            }))}
            unit={GW}
            decimals={1}
            height={MAIN_HEIGHT}
            ariaLabel={`${zone.label} daily generation by fuel group over the last year`}
          />
        )}
      </ChartCard>

      <ChartCard
        title="How much of it is renewable?"
        takeaway={
          shareNow
            ? latestLevelTakeaway(
                "The renewable share of generation",
                shareNow.value,
                "%",
                0,
                shareNow.ts,
              )
            : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">How it is computed</p>
            <p>
              Wind, solar, hydro (excluding pumped storage) and bioenergy as a share of the
              generation shown above, per day. It is a share of reported generation, not of
              consumption: imports and exports are not included.
            </p>
          </>
        }
        info={{ ...mixInfo, unit: "%" }}
        status={mix === null ? "error" : mix.share.length === 0 ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {mix && (
          <TimeSeriesChart
            name="Renewable share"
            commodity="power"
            data={mix.share}
            unit="%"
            decimals={0}
            height={CHART_HEIGHT}
            ariaLabel={`${zone.label} renewable share of daily generation over the last year`}
          />
        )}
      </ChartCard>
    </div>
  );
}

/** Rule: the largest group on the latest complete day, and its share of generation. */
function mixTakeaway(
  groups: { name: string; points: Points }[],
  date: string,
  total: number,
): string {
  const values = groups.map((g) => ({
    name: g.name,
    value: g.points.find(([ts]) => ts === date)?.[1] ?? 0,
  }));
  const top = values.reduce((a, b) => (b.value > a.value ? b : a));
  const share = total > 0 ? (top.value / total) * 100 : 0;
  return `${top.name} was the largest source on ${formatDate(date)}: ${formatNumber(top.value / 1000, 1)} ${GW} on average, ${formatNumber(share, 0)}% of generation.`;
}

// Flows ------------------------------------------------------------------------------------------

export async function FlowsTab({ ctx, zone }: { ctx: PageContext; zone: PowerZone }) {
  const flows = FLOWS[zone.id];
  if (!flows) {
    return (
      <DataGapNotice
        title="German cross-border flows are not shown yet"
        reason="SMARD publishes them per neighbour; they are planned with the other European zones in phase 2. France–Germany exchanges are visible from the France view."
      />
    );
  }
  const from = daysAgo(ctx.now, YEAR_DAYS);
  const lines = await Promise.all(
    flows.lines.map(async (l) => ({ name: l.name, points: await sumOf(l.codes, from) })),
  );
  const codes = flows.lines.flatMap((l) => l.codes);
  const failed = lines.some((l) => l.points === null);
  const shown = lines.filter((l) => l.points !== null && l.points.length > 0);
  const subject = zone.id === "fr" ? "France" : "Great Britain";

  return (
    <div className="grid gap-4">
      <ChartCard
        title={`Is ${subject} importing or exporting power?`}
        takeaway={
          shown.length > 0
            ? flowsTakeaway(subject, shown as { name: string; points: Points }[])
            : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              {zone.id === "fr"
                ? "Scheduled commercial exchanges with each neighbour, average power per day (RTE). Positive means France imports, negative means France exports. Germany and Belgium form one flow-based border in RTE's data."
                : "Net flow on each interconnector, average power per day, added up per neighbouring country. Positive means Great Britain imports, negative means it exports."}
            </p>
          </>
        }
        info={chartInfo(seriesOf(ctx, ...codes), ctx.extractionDates, ctx.now, {
          source: flows.source,
          unit: GW,
        })}
        status={shown.length > 0 ? "ready" : failed ? "error" : "empty"}
        height={MAIN_HEIGHT}
      >
        <MultiLineChart
          series={shown.map((l) => ({ name: l.name, data: rescale(l.points as Points, "MW") }))}
          unit={GW}
          decimals={1}
          height={MAIN_HEIGHT}
          ariaLabel={`${subject} net imports by neighbour, daily, over the last year`}
        />
      </ChartCard>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[480px] text-sm">
          <caption className="sr-only">Net imports by neighbour, latest day</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Neighbour</th>
              <th className="px-3 py-2 text-right font-medium">Latest ({GW})</th>
              <th className="px-3 py-2 text-right font-medium">A year earlier ({GW})</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map(({ name, points }) => {
              const scaled = points && rescale(points, "MW");
              return (
                <tr key={name}>
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2 text-right">
                    {formatNumber((scaled && latest(scaled)?.value) ?? null, 2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatNumber(scaled && valueDaysBefore(scaled, 364), 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Rule: net position over all neighbours on the latest day every neighbour reported. */
function flowsTakeaway(
  subject: string,
  lines: { name: string; points: Points }[],
): string | undefined {
  const net = sumOnDates(lines.map((l) => l.points));
  const now = latest(net);
  if (!now) return undefined;
  const gw = formatNumber(Math.abs(now.value) / 1000, 1);
  const date = formatDate(now.ts);
  return now.value >= 0
    ? `${subject} was a net importer on ${date}: ${gw} ${GW} on average across the borders shown.`
    : `${subject} was a net exporter on ${date}: ${gw} ${GW} on average across the borders shown.`;
}

// Positioning and gaps ---------------------------------------------------------------------------

export function PositioningTab() {
  return (
    <DataGapNotice
      title="No positioning data for European power"
      reason="EEX publishes weekly MiFID position reports for German power futures; their terms of reuse still have to be checked (phase 2). There is no Commitments of Traders report for these contracts."
    />
  );
}

export function GapsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DECLARED_GAPS.filter((g) => g.markets.includes("power")).map((gap) => (
        <DataGapNotice key={gap.title} title={gap.title} reason={gap.reason} />
      ))}
    </div>
  );
}
