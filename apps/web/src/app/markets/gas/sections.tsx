import Link from "next/link";

import { ChartCard } from "@/components/chart-card";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { SeasonalChart } from "@/components/charts/seasonal-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DataGapNotice } from "@/components/data-gap-notice";
import { KpiCard } from "@/components/kpi-card";
import {
  changeFromPrevious,
  changeOverDays,
  compareWithSeason,
  latest,
  percentileRank,
  valueDaysBefore,
} from "@/lib/analytics";
import { chartInfo } from "@/lib/data/chart-info";
import { DECLARED_GAPS } from "@/lib/data/declared-gaps";
import { getPoints, getSeasonal, type SeasonalRow } from "@/lib/data/series";
import { displayUnit, rescale } from "@/lib/display-units";
import { formatChange, formatNumber, formatPercentile } from "@/lib/format";
import {
  largestFlowTakeaway,
  latestLevelTakeaway,
  monthlyBenchmarkTakeaway,
  promptSpreadTakeaway,
  storageTakeaway,
} from "@/lib/takeaways";
import { cn } from "@/lib/utils";

import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";

import { ENTRY_POINTS, gasHref, STORAGE_AREAS, type StorageArea } from "./data";

const MAIN_HEIGHT = 320;
const CHART_HEIGHT = 280;
const YEAR_DAYS = 366;

/** Day of the latest current-year value in a seasonal table, as an ISO date in the current year. */
function lastSeasonalDay(rows: SeasonalRow[], year: number): string | null {
  const row = rows.findLast((r) => r.current !== null);
  return row ? `${year}${row.day.slice(4)}T00:00:00Z` : null;
}

function seasonalChartProps(rows: SeasonalRow[]) {
  return {
    periods: rows.map((r) => r.day),
    dailyAxis: true,
    min: rows.map((r) => r.min),
    max: rows.map((r) => r.max),
    average: rows.map((r) => r.mean),
    current: rows.map((r) => r.current),
  };
}

const SEASONAL_METHOD = (rangeLabel: string) => (
  <>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>
      For each calendar day, the band is the minimum to maximum and the dashed line the mean of the
      same day in {rangeLabel}; the current year is excluded from the norm. 29 February is left out.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      GIE publishes estimated values first and confirms them later; the latest days can still be
      revised.
    </p>
  </>
);

// KPIs ---------------------------------------------------------------------------------------------

export async function GasKpis({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, YEAR_DAYS);
  const [full, storage, front, spread, seasonal] = await Promise.all([
    attempt("EU fill", getPoints("agsi.eu.full", from)),
    attempt("EU storage", getPoints("agsi.eu.storage", from)),
    attempt("TTF front", getPoints("yahoo.ttf.front_month", from)),
    attempt("TTF spread", getPoints("yahoo.ttf.m1_m2_spread", from)),
    attempt("EU seasonal", getSeasonal("agsi.eu.full", ctx.year)),
  ]);

  const fullNow = full && latest(full);
  const seasonalRow =
    fullNow && seasonal?.find((r) => r.day.slice(5, 10) === fullNow.ts.slice(5, 10));
  const comparison = seasonalRow ? compareWithSeason(seasonalRow) : null;
  const storageNow = storage && latest(storage);
  const frontNow = front && latest(front);
  const spreadNow = spread && latest(spread);

  return (
    <>
      <KpiCard
        commodity="natgas"
        label="EU storage, % full"
        value={fullNow?.value ?? null}
        unit="%"
        asOf={fullNow?.ts}
        change={{ value: full && changeOverDays(full, 7), label: "pts vs a week earlier" }}
        context={
          comparison
            ? [
                {
                  label: `vs ${ctx.rangeLabel} avg`,
                  value: `${formatChange(comparison.deviation, 1)} pts`,
                },
                { label: `${ctx.rangeLabel} range`, value: `${comparison.position} the range` },
              ]
            : []
        }
      />
      <KpiCard
        commodity="natgas"
        label="EU gas in storage"
        value={storageNow?.value ?? null}
        unit="TWh"
        asOf={storageNow?.ts}
        change={{ value: storage && changeOverDays(storage, 7), label: "vs a week earlier" }}
      />
      <KpiCard
        commodity="natgas"
        label="TTF front month (NYMEX)"
        value={frontNow?.value ?? null}
        unit="€/MWh"
        asOf={frontNow?.ts}
        change={{ value: front && changeFromPrevious(front), label: "vs previous close" }}
        context={
          frontNow && front
            ? [
                {
                  label: "1-year percentile",
                  value: formatPercentile(
                    percentileRank(
                      frontNow.value,
                      front.map(([, v]) => v),
                    ),
                  ),
                },
              ]
            : []
        }
        unofficial
      />
      <KpiCard
        commodity="natgas"
        label="TTF M1–M2 spread (NYMEX)"
        value={spreadNow?.value ?? null}
        unit="€/MWh"
        asOf={spreadNow?.ts}
        change={{ value: spread && changeFromPrevious(spread), label: "vs previous close" }}
        unofficial
      />
    </>
  );
}

// Main chart -------------------------------------------------------------------------------------

export async function MainStorageChart({ ctx }: { ctx: PageContext }) {
  const rows = await attempt("EU seasonal", getSeasonal("agsi.eu.full", ctx.year));
  const meta = seriesOf(ctx, "agsi.eu.full");
  const day = rows && lastSeasonalDay(rows, ctx.year);
  const row = day && rows?.find((r) => r.day.slice(5, 10) === day.slice(5, 10));
  const comparison = row ? compareWithSeason(row) : null;
  const status =
    rows === null ? "error" : rows.every((r) => r.current === null) ? "empty" : "ready";

  return (
    <ChartCard
      title="Are EU gas stocks tight for the season?"
      takeaway={
        comparison && day ? storageTakeaway("EU", day, comparison, ctx.rangeLabel) : undefined
      }
      method={SEASONAL_METHOD(ctx.rangeLabel)}
      info={chartInfo(meta, ctx.extractionDates, ctx.now, { source: "GIE AGSI+", unit: "%" })}
      status={status}
      height={MAIN_HEIGHT}
    >
      {rows && (
        <SeasonalChart
          commodity="natgas"
          {...seasonalChartProps(rows)}
          currentLabel={String(ctx.year)}
          rangeLabel={ctx.rangeLabel}
          unit="%"
          decimals={1}
          yMax={100}
          height={MAIN_HEIGHT}
          ariaLabel={`EU gas storage filling level in ${ctx.year} against the ${ctx.rangeLabel} range and average`}
        />
      )}
    </ChartCard>
  );
}

// Prices & curve ---------------------------------------------------------------------------------

export async function PricesTab({ ctx }: { ctx: PageContext }) {
  const tenYears = daysAgo(ctx.now, 10 * 365);
  const [spread, imf, henryHub] = await Promise.all([
    attempt("TTF spread", getPoints("yahoo.ttf.m1_m2_spread", daysAgo(ctx.now, YEAR_DAYS))),
    attempt("IMF Europe gas", getPoints("fred.eu_gas_imf_monthly", tenYears)),
    attempt("Henry Hub", getPoints("eia.henry_hub_spot", daysAgo(ctx.now, 5 * 365))),
  ]);
  const spreadNow = spread && latest(spread);
  const imfNow = imf && latest(imf);
  const imfYearAgo =
    imfNow && imf
      ? (imf.find(
          ([ts]) =>
            ts.slice(0, 7) === `${Number(imfNow.ts.slice(0, 4)) - 1}${imfNow.ts.slice(4, 7)}`,
        )?.[1] ?? null)
      : null;
  const hhNow = henryHub && latest(henryHub);

  return (
    <div className="grid gap-4">
      <ChartCard
        title="Is the TTF prompt curve in backwardation or contango?"
        takeaway={spreadNow ? promptSpreadTakeaway(spreadNow.value, spreadNow.ts) : undefined}
        method={
          <>
            <p className="font-medium text-foreground">How it is computed</p>
            <p>
              Close of the contract for the month after the trading date minus the contract for the
              month after that (NYMEX Dutch TTF, Platts-based). Positive means backwardation.
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>
              Unofficial data. Yahoo lists only the contracts still trading, so the history starts
              on 1 October 2026 and grows daily; days where either month is missing have no value.
              No raw futures prices are shown (ADR 0003).
            </p>
          </>
        }
        info={chartInfo(seriesOf(ctx, "yahoo.ttf.m1_m2_spread"), ctx.extractionDates, ctx.now, {
          source: "Yahoo Finance",
          unit: "€/MWh",
        })}
        status={spread === null ? "error" : spread.length === 0 ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {spread && (
          <TimeSeriesChart
            name="M1–M2 spread"
            commodity="natgas"
            data={spread}
            unit="€/MWh"
            decimals={2}
            height={CHART_HEIGHT}
            ariaLabel="TTF M1 minus M2 spread, daily"
          />
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Where is the official European gas benchmark?"
          takeaway={
            imfNow ? monthlyBenchmarkTakeaway(imfNow.value, imfNow.ts, imfYearAgo) : undefined
          }
          method={
            <>
              <p className="font-medium text-foreground">What it shows</p>
              <p>
                The IMF primary commodity price for natural gas in Europe: a monthly average in
                nominal US dollars, published with a delay of several weeks. It is the official
                benchmark we can redistribute; daily hub prices are licensed.
              </p>
            </>
          }
          info={chartInfo(seriesOf(ctx, "fred.eu_gas_imf_monthly"), ctx.extractionDates, ctx.now, {
            source: "FRED",
            unit: "$/MMBtu",
          })}
          status={imf === null ? "error" : imf.length === 0 ? "empty" : "ready"}
          height={CHART_HEIGHT}
        >
          {imf && (
            <TimeSeriesChart
              name="IMF Europe gas"
              commodity="natgas"
              data={imf}
              unit="$/MMBtu"
              decimals={2}
              height={CHART_HEIGHT}
              ariaLabel="IMF European natural gas price, monthly, ten years"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Henry Hub, for context"
          takeaway={
            hhNow
              ? latestLevelTakeaway("The Henry Hub spot price", hhNow.value, "$/MMBtu", 2, hhNow.ts)
              : undefined
          }
          method={
            <>
              <p className="font-medium text-foreground">What it shows</p>
              <p>
                US benchmark spot price, shown separately as context. It is never combined with
                European prices in a spread: different markets, units and price types.
              </p>
            </>
          }
          info={chartInfo(seriesOf(ctx, "eia.henry_hub_spot"), ctx.extractionDates, ctx.now, {
            source: "EIA",
            unit: "$/MMBtu",
          })}
          status={henryHub === null ? "error" : henryHub.length === 0 ? "empty" : "ready"}
          height={CHART_HEIGHT}
        >
          {henryHub && (
            <TimeSeriesChart
              name="Henry Hub spot"
              commodity="natgas"
              data={henryHub}
              unit="$/MMBtu"
              decimals={2}
              height={CHART_HEIGHT}
              ariaLabel="Henry Hub natural gas spot price, daily, five years"
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// Balance & stocks -------------------------------------------------------------------------------

export async function StorageTab({ ctx, area }: { ctx: PageContext; area: StorageArea }) {
  const areaLabel = STORAGE_AREAS.find((a) => a.id === area)?.label ?? "EU";
  const tables = await Promise.all(
    STORAGE_AREAS.map(async (a) => ({
      area: a,
      seasonal: await attempt(`${a.id} seasonal`, getSeasonal(`agsi.${a.id}.full`, ctx.year)),
      points: await attempt(`${a.id} fill`, getPoints(`agsi.${a.id}.full`, daysAgo(ctx.now, 30))),
    })),
  );
  const selected = tables.find((t) => t.area.id === area);
  const rows = selected?.seasonal ?? null;
  const day = rows && lastSeasonalDay(rows, ctx.year);
  const row = day && rows?.find((r) => r.day.slice(5, 10) === day.slice(5, 10));
  const comparison = row ? compareWithSeason(row) : null;

  return (
    <div className="grid gap-4">
      <nav aria-label="Storage by country" className="flex flex-wrap gap-1.5">
        {STORAGE_AREAS.map((a) => (
          <Link
            key={a.id}
            href={gasHref("storage", a.id)}
            scroll={false}
            aria-current={a.id === area ? "true" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-muted",
              a.id === area && "border-primary bg-muted font-medium",
            )}
          >
            {a.label}
          </Link>
        ))}
      </nav>

      <ChartCard
        title={`Is ${areaLabel} storage tight for the season?`}
        takeaway={
          comparison && day
            ? storageTakeaway(areaLabel, day, comparison, ctx.rangeLabel)
            : undefined
        }
        method={SEASONAL_METHOD(ctx.rangeLabel)}
        info={chartInfo(seriesOf(ctx, `agsi.${area}.full`), ctx.extractionDates, ctx.now, {
          source: "GIE AGSI+",
          unit: "%",
        })}
        status={rows === null ? "error" : rows.every((r) => r.current === null) ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {rows && (
          <SeasonalChart
            commodity="natgas"
            {...seasonalChartProps(rows)}
            currentLabel={String(ctx.year)}
            rangeLabel={ctx.rangeLabel}
            unit="%"
            decimals={1}
            yMax={100}
            height={CHART_HEIGHT}
            ariaLabel={`${areaLabel} gas storage filling level against the ${ctx.rangeLabel} range`}
          />
        )}
      </ChartCard>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Storage filling level by country</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="px-3 py-2 text-right font-medium">% full</th>
              <th className="px-3 py-2 text-right font-medium">vs a week earlier</th>
              <th className="px-3 py-2 text-right font-medium">vs {ctx.rangeLabel} avg</th>
              <th className="px-3 py-2 font-medium">{ctx.rangeLabel} range</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tables.map(({ area: a, seasonal, points }) => {
              const now = points && latest(points);
              const r = now && seasonal?.find((x) => x.day.slice(5, 10) === now.ts.slice(5, 10));
              const c = r ? compareWithSeason(r) : null;
              return (
                <tr key={a.id}>
                  <td className="px-3 py-2">{a.label}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(now?.value ?? null, 1)}</td>
                  <td className="px-3 py-2 text-right">
                    {formatChange(points && changeOverDays(points, 7), 1)} pts
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatChange(c?.deviation ?? null, 1)} pts
                  </td>
                  <td className="px-3 py-2">{c ? `${c.position}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Flows ------------------------------------------------------------------------------------------

export async function FlowsTab({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, YEAR_DAYS);
  const metas = seriesOf(ctx, ...ENTRY_POINTS);
  const flows = await Promise.all(
    metas.map(async (m) => ({ meta: m, points: await attempt(m.code, getPoints(m.code, from)) })),
  );
  const unit = displayUnit("kWh/d").unit;
  const reported = flows.filter((f) => f.points !== null && f.points.length > 0);
  // A stack must end on the last day every point reported: a point that has not published yet would
  // otherwise look like a fall in flows. The table below still shows each point's latest value.
  const lastCommon = reported
    .map((f) => f.points?.at(-1)?.[0])
    .filter((d): d is string => d !== undefined)
    .sort()
    .at(0);
  const lines = reported.map((f) => ({
    name: f.meta.name.replace(/ entry flow.*$/, ""),
    data: rescale(f.points ?? [], f.meta.unit).filter(([ts]) => !lastCommon || ts <= lastCommon),
  }));
  const takeaway =
    lastCommon &&
    largestFlowTakeaway(
      lastCommon,
      lines.map((l) => ({
        name: l.name,
        value: l.data.find(([ts]) => ts === lastCommon)?.[1] ?? null,
      })),
      unit,
    );

  return (
    <div className="grid gap-4">
      <ChartCard
        title="Where is pipeline gas entering the EU?"
        takeaway={takeaway ?? undefined}
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              Physical flows at nine distinct entry points, each as reported by a single operator,
              stacked: the top of the stack is the total of these points, not total EU imports (LNG,
              Norwegian flows into Germany and other routes are not included).
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>
              Norwegian flows into Germany (Emden, Dornum) are not shown: several operators report
              them with overlapping values. The chart ends on the last day every point reported, so
              a late publication does not look like a fall in flows. Recent values can be
              provisional.
            </p>
          </>
        }
        info={chartInfo(metas, ctx.extractionDates, ctx.now, { source: "ENTSOG", unit })}
        status={
          lines.length > 0 ? "ready" : flows.some((f) => f.points === null) ? "error" : "empty"
        }
        height={MAIN_HEIGHT}
      >
        <MultiLineChart
          stacked
          series={lines}
          unit={unit}
          decimals={0}
          height={MAIN_HEIGHT}
          ariaLabel="Daily physical gas flows at nine EU entry points over the last year"
        />
      </ChartCard>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Latest flow by entry point</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Entry point</th>
              <th className="px-3 py-2 text-right font-medium">Latest ({unit})</th>
              <th className="px-3 py-2 text-right font-medium">A year earlier ({unit})</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {flows.map(({ meta, points }) => {
              const scaled = points && rescale(points, meta.unit);
              const now = scaled && latest(scaled);
              const yearAgo = scaled && valueDaysBefore(scaled, 364);
              return (
                <tr key={meta.code}>
                  <td className="px-3 py-2">
                    <p>{meta.name}</p>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(now?.value ?? null, 0)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(yearAgo, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Positioning and gaps ---------------------------------------------------------------------------

export function PositioningTab() {
  return (
    <DataGapNotice
      title="TTF positioning (Commitments of Traders) is not shown"
      reason="ICE publishes Commitments of Traders for TTF, but its terms forbid republication without written permission. The CFTC report does not cover TTF."
    />
  );
}

export function GapsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DECLARED_GAPS.filter((g) => g.markets.includes("gas")).map((gap) => (
        <DataGapNotice key={gap.title} title={gap.title} reason={gap.reason} />
      ))}
    </div>
  );
}
