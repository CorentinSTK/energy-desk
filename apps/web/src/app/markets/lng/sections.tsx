import Link from "next/link";

import { ChartCard } from "@/components/chart-card";
import { SeasonalChart } from "@/components/charts/seasonal-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DataGapNotice } from "@/components/data-gap-notice";
import { KpiCard } from "@/components/kpi-card";
import { changeOverDays, compareWithSeason, latest, sharePercent } from "@/lib/analytics";
import { chartInfo } from "@/lib/data/chart-info";
import { DECLARED_GAPS } from "@/lib/data/declared-gaps";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints, getSeasonal, type Points, type SeasonalRow } from "@/lib/data/series";
import { formatChange, formatNumber } from "@/lib/format";
import { latestLevelTakeaway, seasonalLevelTakeaway } from "@/lib/takeaways";
import { cn } from "@/lib/utils";

import { LNG_AREAS, type LngArea, lngHref } from "./data";

const MAIN_HEIGHT = 320;
const CHART_HEIGHT = 280;
const YEAR_DAYS = 366;

function lastSeasonalDay(rows: SeasonalRow[], year: number): string | null {
  const row = rows.findLast((r) => r.current !== null);
  return row ? `${year}${row.day.slice(4)}T00:00:00Z` : null;
}

function valueOn(points: Points | null, isoDate: string | undefined): number | null {
  if (!points || !isoDate) return null;
  return points.find(([ts]) => ts === isoDate)?.[1] ?? null;
}

const SEND_OUT_METHOD = (rangeLabel: string) => (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>
      Regasified LNG sent from EU terminals into the grid each gas day, against the minimum to
      maximum (band) and mean (dashed) of the same calendar day in {rangeLabel}.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      Daily send-out is volatile (cargo arrivals, maintenance). Recent values are estimates until
      GIE confirms them. Isolated implausible values reported by the source are rejected and listed
      on the data page.
    </p>
  </>
);

// KPIs ---------------------------------------------------------------------------------------------

export async function LngKpis({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, 30);
  const [inventory, maximum, sendOut, seasonal] = await Promise.all([
    attempt("EU LNG inventory", getPoints("alsi.eu.inventory", from)),
    attempt("EU LNG DTMI", getPoints("alsi.eu.dtmi", from)),
    attempt("EU send-out", getPoints("alsi.eu.send_out", from)),
    attempt("EU send-out seasonal", getSeasonal("alsi.eu.send_out", ctx.year)),
  ]);
  const invNow = inventory && latest(inventory);
  const share = sharePercent(invNow?.value ?? null, valueOn(maximum, invNow?.ts));
  const sendNow = sendOut && latest(sendOut);
  const row = sendNow && seasonal?.find((r) => r.day.slice(5, 10) === sendNow.ts.slice(5, 10));
  const comparison = row ? compareWithSeason(row) : null;

  return (
    <>
      <KpiCard
        commodity="lng"
        label="EU LNG in tanks"
        value={invNow?.value ?? null}
        unit="GWh"
        decimals={0}
        asOf={invNow?.ts}
        change={{ value: inventory && changeOverDays(inventory, 7), label: "vs a week earlier" }}
      />
      <KpiCard
        commodity="lng"
        label="Tank fill, % of declared maximum"
        value={share}
        unit="%"
        asOf={invNow?.ts}
      />
      <KpiCard
        commodity="lng"
        label="EU LNG send-out"
        value={sendNow?.value ?? null}
        unit="GWh/d"
        asOf={sendNow?.ts}
        change={{ value: sendOut && changeOverDays(sendOut, 7), label: "vs a week earlier" }}
        context={
          comparison
            ? [
                {
                  label: `vs ${ctx.rangeLabel} avg`,
                  value: `${formatChange((comparison.deviation / comparison.mean) * 100, 0)}%`,
                },
              ]
            : []
        }
      />
    </>
  );
}

// Main chart -------------------------------------------------------------------------------------

export async function MainSendOutChart({ ctx, area }: { ctx: PageContext; area: LngArea }) {
  const label = LNG_AREAS.find((a) => a.id === area)?.label ?? "EU";
  const code = `alsi.${area}.send_out`;
  const rows = await attempt(`${area} send-out seasonal`, getSeasonal(code, ctx.year));
  const day = rows && lastSeasonalDay(rows, ctx.year);
  const row = day && rows?.find((r) => r.day.slice(5, 10) === day.slice(5, 10));
  const comparison = row ? compareWithSeason(row) : null;

  return (
    <ChartCard
      title={`How much LNG is ${label === "EU" ? "the EU" : label} sending out compared with normal?`}
      takeaway={
        comparison && day
          ? seasonalLevelTakeaway(
              `${label} LNG send-out`,
              day,
              comparison,
              "GWh/d",
              0,
              ctx.rangeLabel,
            )
          : undefined
      }
      method={SEND_OUT_METHOD(ctx.rangeLabel)}
      info={chartInfo(seriesOf(ctx, code), ctx.extractionDates, ctx.now, {
        source: "GIE ALSI",
        unit: "GWh/d",
      })}
      status={rows === null ? "error" : rows.every((r) => r.current === null) ? "empty" : "ready"}
      height={MAIN_HEIGHT}
    >
      {rows && (
        <SeasonalChart
          commodity="lng"
          periods={rows.map((r) => r.day)}
          dailyAxis
          min={rows.map((r) => r.min)}
          max={rows.map((r) => r.max)}
          average={rows.map((r) => r.mean)}
          current={rows.map((r) => r.current)}
          currentLabel={String(ctx.year)}
          rangeLabel={ctx.rangeLabel}
          unit="GWh/d"
          decimals={0}
          height={MAIN_HEIGHT}
          ariaLabel={`${label} LNG send-out in ${ctx.year} against the ${ctx.rangeLabel} range and average`}
        />
      )}
    </ChartCard>
  );
}

// Balance & stocks: terminals by country ---------------------------------------------------------

export async function TerminalsTab({ ctx, area }: { ctx: PageContext; area: LngArea }) {
  const label = LNG_AREAS.find((a) => a.id === area)?.label ?? "EU";
  const from = daysAgo(ctx.now, YEAR_DAYS);
  const inventory = await attempt(`${area} inventory`, getPoints(`alsi.${area}.inventory`, from));
  const table = await Promise.all(
    LNG_AREAS.map(async (a) => {
      const recent = daysAgo(ctx.now, 30);
      const [inv, max, send] = await Promise.all([
        attempt(`${a.id} inventory`, getPoints(`alsi.${a.id}.inventory`, recent)),
        attempt(`${a.id} DTMI`, getPoints(`alsi.${a.id}.dtmi`, recent)),
        attempt(`${a.id} send-out`, getPoints(`alsi.${a.id}.send_out`, recent)),
      ]);
      const invNow = inv && latest(inv);
      return {
        area: a,
        inventory: invNow?.value ?? null,
        share: sharePercent(invNow?.value ?? null, valueOn(max, invNow?.ts)),
        sendOut: (send && latest(send)?.value) ?? null,
      };
    }),
  );
  const invNow = inventory && latest(inventory);

  return (
    <div className="grid gap-4">
      <nav aria-label="LNG by country" className="flex flex-wrap gap-1.5">
        {LNG_AREAS.map((a) => (
          <Link
            key={a.id}
            href={lngHref("terminals", a.id)}
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
        title={`How full are ${label === "EU" ? "EU" : label} LNG tanks?`}
        takeaway={
          invNow
            ? latestLevelTakeaway(
                `LNG held in ${label} terminals`,
                invNow.value,
                "GWh",
                0,
                invNow.ts,
              )
            : undefined
        }
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>LNG held in terminal tanks at the end of each gas day, in energy terms (GWh).</p>
          </>
        }
        info={chartInfo(seriesOf(ctx, `alsi.${area}.inventory`), ctx.extractionDates, ctx.now, {
          source: "GIE ALSI",
          unit: "GWh",
        })}
        status={inventory === null ? "error" : inventory.length === 0 ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {inventory && (
          <TimeSeriesChart
            name="LNG inventory"
            commodity="lng"
            data={inventory}
            unit="GWh"
            decimals={0}
            height={CHART_HEIGHT}
            ariaLabel={`${label} LNG terminal inventory over the last year`}
          />
        )}
      </ChartCard>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[520px] text-sm">
          <caption className="sr-only">LNG terminals by country, latest gas day</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="px-3 py-2 text-right font-medium">In tanks (GWh)</th>
              <th className="px-3 py-2 text-right font-medium">% of declared maximum</th>
              <th className="px-3 py-2 text-right font-medium">Send-out (GWh/d)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {table.map((r) => (
              <tr key={r.area.id}>
                <td className="px-3 py-2">{r.area.label}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.inventory, 0)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.share, 1)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.sendOut, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Tabs not covered by free data ------------------------------------------------------------------

export function LngPricesTab() {
  return (
    <div className="grid gap-3">
      <DataGapNotice
        title="No LNG price is shown"
        reason="Delivered LNG prices (e.g. JKM, NWE DES) are licensed assessments. European gas prices and the TTF prompt spread are on the gas page."
      />
      <p className="text-sm text-muted-foreground">
        See{" "}
        <Link href="/markets/gas" className="text-primary underline underline-offset-2">
          European natural gas
        </Link>{" "}
        for the official monthly benchmark and TTF curve indicators.
      </p>
    </div>
  );
}

export function LngFlowsTab() {
  return (
    <DataGapNotice
      title="LNG imports by origin are not shown"
      reason="Cargo-level data (origin, vessel, destination) comes from licensed ship-tracking services. Send-out into the grid is shown under Balance & stocks."
    />
  );
}

export function LngPositioningTab() {
  return (
    <DataGapNotice
      title="No positioning data for LNG"
      reason="There is no public Commitments of Traders report for LNG contracts."
    />
  );
}

export function LngGapsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DECLARED_GAPS.filter((g) => g.markets.includes("lng")).map((gap) => (
        <DataGapNotice key={gap.title} title={gap.title} reason={gap.reason} />
      ))}
    </div>
  );
}
