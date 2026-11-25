import Link from "next/link";

import { ChartCard } from "@/components/chart-card";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { SeasonalChart } from "@/components/charts/seasonal-chart";
import { DataGapNotice } from "@/components/data-gap-notice";
import { ErrorState } from "@/components/error-state";
import { SourceEventNotice } from "@/components/freight/source-event-notice";
import { KpiCard } from "@/components/kpi-card";
import { chartInfo } from "@/lib/data/chart-info";
import { DECLARED_GAPS } from "@/lib/data/declared-gaps";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPoints, getPointsMany, getSeasonal } from "@/lib/data/series";
import { getShippingEvents, type ShippingEvent } from "@/lib/data/shipping-events";
import { rescale } from "@/lib/display-units";
import {
  CHOKEPOINTS,
  type ChokepointId,
  PORTWATCH_SOURCE,
  transitCode,
} from "@/lib/freight/chokepoints";
import { everyNthDay, rollingMean, weekVsSeason, WINDOW_DAYS } from "@/lib/freight/rolling";
import { extraDays, KNOTS, ROUTES } from "@/lib/freight/routes";
import { chokepointTakeaway } from "@/lib/freight/takeaway";
import { formatChange, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { freightHref } from "./data";

const MAIN_HEIGHT = 340;
const CHART_HEIGHT = 280;
/** Two years of daily transits, plus the 6 days the first 7-day mean needs. */
const MAIN_DAYS = 2 * 366 + WINDOW_DAYS;
const RECENT_DAYS = 45;
const VESSELS = "vessels/d";

/** The chokepoints the headline indicators follow: the Gulf exits and the two ways to Europe. */
export const KPI_CHOKEPOINTS: ChokepointId[] = ["hormuz", "bab_el_mandeb", "suez", "cape"];

const label = (id: ChokepointId) => CHOKEPOINTS.find((c) => c.id === id)?.label ?? id;

function eventsFor(events: ShippingEvent[] | null, portwatchIds: string[], from: string) {
  return (events ?? [])
    .filter((e) => e.chokepoints.some((c) => portwatchIds.includes(c)))
    .filter((e) => (e.endsOn ?? "9999") >= from.slice(0, 10));
}

const TRANSITS_METHOD = (rangeLabel: string) => (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>
      Tankers crossing each chokepoint per day, as weekly points: the mean over 7 consecutive days,
      every 7th day back from the latest published day. A 7-day mean is left out when any day of its
      window is missing. The norm is the mean of the same calendar days in {rangeLabel}. Dashed
      lines mark disruption events as IMF PortWatch publishes them.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      PortWatch counts transits from AIS vessel signals (a ship crossing over several days counts
      once). Ships that switch off their transponders, or signal jamming, lower the counts.
      PortWatch publishes about five days behind.
    </p>
  </>
);

// KPIs ---------------------------------------------------------------------------------------------

export async function FreightKpis({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, RECENT_DAYS);
  const weeks = await Promise.all(
    KPI_CHOKEPOINTS.map(async (id) => {
      const code = transitCode(id, "tanker_transits");
      const [points, seasonal] = await Promise.all([
        attempt(`${id} tankers`, getPoints(code, from)),
        attempt(`${id} tankers seasonal`, getSeasonal(code, ctx.year)),
      ]);
      return { id, week: points && seasonal ? weekVsSeason(points, seasonal) : null };
    }),
  );
  return (
    <>
      {weeks.map(({ id, week }) => (
        <KpiCard
          key={id}
          commodity="freight"
          label={`${label(id)}, tankers per day`}
          value={week?.value ?? null}
          unit="7-day mean"
          decimals={1}
          asOf={week?.asOf}
          context={
            week
              ? [
                  {
                    label: `vs ${ctx.rangeLabel} norm (${formatNumber(week.normal, 1)})`,
                    value:
                      week.deviationPct === null ? "—" : `${formatChange(week.deviationPct, 0)}%`,
                  },
                ]
              : []
          }
        />
      ))}
    </>
  );
}

// Main chart -------------------------------------------------------------------------------------

export async function MainChokepointChart({ ctx }: { ctx: PageContext }) {
  const from = daysAgo(ctx.now, MAIN_DAYS);
  const codes = CHOKEPOINTS.map((c) => transitCode(c.id, "tanker_transits"));
  const [loaded, seasonals, events] = await Promise.all([
    Promise.all(codes.map((code) => attempt(code, getPoints(code, from)))),
    Promise.all(codes.map((code) => attempt(`${code} seasonal`, getSeasonal(code, ctx.year)))),
    attempt("shipping events", getShippingEvents()),
  ]);
  const failed = loaded.some((p) => p === null);
  // Weekly points (the 7-day mean every 7th day), rounded for the chart only (it shows 1 decimal):
  // 8 lines of daily means made the chart slow to draw.
  const means = loaded.map((p) =>
    p
      ? everyNthDay(rollingMean(p)).map(([ts, v]): [string, number] => [
          ts,
          Math.round(v * 100) / 100,
        ])
      : [],
  );
  const empty = means.every((m) => m.length === 0);
  const weeks = CHOKEPOINTS.flatMap((c, i) => {
    const points = loaded[i];
    const seasonal = seasonals[i];
    const week = points && seasonal ? weekVsSeason(points, seasonal) : null;
    return week ? [{ ...week, label: c.label }] : [];
  });
  const shown = eventsFor(
    events,
    CHOKEPOINTS.map((c) => c.portwatchId),
    from,
  );

  return (
    <ChartCard
      title="Are the oil and LNG chokepoints open?"
      takeaway={!failed && !empty ? chokepointTakeaway(weeks, ctx.rangeLabel) : undefined}
      method={TRANSITS_METHOD(ctx.rangeLabel)}
      info={chartInfo(seriesOf(ctx, ...codes), ctx.extractionDates, ctx.now, {
        source: PORTWATCH_SOURCE,
        unit: VESSELS,
      })}
      status={failed ? "error" : empty ? "empty" : "ready"}
      height={MAIN_HEIGHT}
    >
      <MultiLineChart
        series={CHOKEPOINTS.map((c, i) => ({ name: c.label, data: means[i], colorIndex: i }))}
        unit={VESSELS}
        decimals={1}
        events={shown.map((e) => ({ date: e.startsOn, label: e.code ?? e.name }))}
        height={MAIN_HEIGHT}
        ariaLabel="Tanker transits per day through eight chokepoints, weekly 7-day means over two years"
      />
    </ChartCard>
  );
}

// Chokepoints tab ----------------------------------------------------------------------------------

export async function ChokepointsTab({ ctx, strait }: { ctx: PageContext; strait: ChokepointId }) {
  const choke = CHOKEPOINTS.find((c) => c.id === strait) ?? CHOKEPOINTS[0];
  const code = transitCode(strait, "tanker_transits");
  const recent = daysAgo(ctx.now, RECENT_DAYS);
  const tableCodes = CHOKEPOINTS.flatMap((c) =>
    (["transits", "tanker_transits", "tanker_tonnes"] as const).map((k) => transitCode(c.id, k)),
  );
  // One query for the table's 24 series rather than 24 concurrent ones.
  const [seasonal, events, recentPoints, norms] = await Promise.all([
    attempt(`${strait} seasonal`, getSeasonal(code, ctx.year)),
    attempt("shipping events", getShippingEvents()),
    attempt("chokepoint table", getPointsMany(tableCodes, recent)),
    Promise.all(
      CHOKEPOINTS.map((c) =>
        attempt(
          `${c.id} tankers seasonal`,
          getSeasonal(transitCode(c.id, "tanker_transits"), ctx.year),
        ),
      ),
    ),
  ]);
  const rows = CHOKEPOINTS.map((c, i) => {
    const pick = (k: "transits" | "tanker_transits" | "tanker_tonnes") =>
      recentPoints?.get(transitCode(c.id, k)) ?? null;
    const all = pick("transits");
    const tankers = pick("tanker_transits");
    const tonnes = pick("tanker_tonnes");
    const norm = norms[i];
    return {
      choke: c,
      allMean: all ? (rollingMean(all).at(-1)?.[1] ?? null) : null,
      tankers: tankers && norm ? weekVsSeason(tankers, norm) : null,
      tonnesMean: tonnes ? (rollingMean(rescale(tonnes, "t/d")).at(-1)?.[1] ?? null) : null,
    };
  });
  const ongoing = eventsFor(events, [choke.portwatchId], ctx.now.toISOString());
  const current = rows.find((r) => r.choke.id === choke.id)?.tankers;
  const measured =
    current && current.deviationPct !== null
      ? `Measured now: ${formatNumber(current.value, 1)} tankers a day in the 7 days to ${formatDate(current.asOf)}, ${formatChange(current.deviationPct, 0)}% against the ${ctx.rangeLabel} norm for those days.`
      : undefined;

  return (
    <div className="grid gap-4">
      <nav
        aria-label="Chokepoint"
        className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-lg bg-muted p-0.5"
      >
        {CHOKEPOINTS.map((c) => (
          <Link
            key={c.id}
            href={freightHref("chokepoints", c.id)}
            scroll={false}
            aria-current={c.id === strait ? "true" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm transition-colors",
              c.id === strait
                ? "bg-surface-raised font-medium text-foreground shadow-sm ring-1 ring-border"
                : "text-text-secondary hover:text-foreground",
            )}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {ongoing.map((e) => (
        <SourceEventNotice
          key={e.eventId}
          event={e}
          source={PORTWATCH_SOURCE}
          measured={measured}
        />
      ))}

      <ChartCard
        title={`Is ${choke.label} busier or quieter than usual for the season?`}
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              Daily tanker transits in {ctx.year} against the minimum to maximum (band) and mean
              (dashed) of the same calendar day in {ctx.rangeLabel}. Daily counts are noisy; the
              table below uses 7-day means.
            </p>
          </>
        }
        info={chartInfo(seriesOf(ctx, code), ctx.extractionDates, ctx.now, {
          source: PORTWATCH_SOURCE,
          unit: VESSELS,
        })}
        status={
          seasonal === null
            ? "error"
            : seasonal.every((r) => r.current === null)
              ? "empty"
              : "ready"
        }
        height={CHART_HEIGHT}
      >
        {seasonal && (
          <SeasonalChart
            commodity="freight"
            periods={seasonal.map((r) => r.day)}
            dailyAxis
            min={seasonal.map((r) => r.min)}
            max={seasonal.map((r) => r.max)}
            average={seasonal.map((r) => r.mean)}
            current={seasonal.map((r) => r.current)}
            currentLabel={String(ctx.year)}
            rangeLabel={ctx.rangeLabel}
            unit={VESSELS}
            decimals={0}
            height={CHART_HEIGHT}
            ariaLabel={`${choke.label} daily tanker transits in ${ctx.year} against the ${ctx.rangeLabel} range and average`}
          />
        )}
      </ChartCard>

      {recentPoints === null ? (
        <ErrorState />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">
              Chokepoints, latest 7-day means of transits and tanker cargo
            </caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Chokepoint</th>
                <th className="px-3 py-2 text-right font-medium">All vessels (per day)</th>
                <th className="px-3 py-2 text-right font-medium">Tankers (per day)</th>
                <th className="px-3 py-2 text-right font-medium">Tankers vs {ctx.rangeLabel}</th>
                <th className="px-3 py-2 text-right font-medium">
                  Tanker cargo, IMF estimate (Mt/d)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.choke.id}>
                  <td className="px-3 py-2">{r.choke.label}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(r.allMean, 1)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(r.tankers?.value, 1)}</td>
                  <td className="px-3 py-2 text-right">
                    {r.tankers?.deviationPct == null
                      ? "—"
                      : `${formatChange(r.tankers.deviationPct, 0)}%`}
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(r.tonnesMean, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        7-day means to the latest published day. Tanker cargo is an IMF model estimate (each
        ship&apos;s estimated payload times its deadweight tonnage), not a measured volume.
      </p>
    </div>
  );
}

// Routes tab ---------------------------------------------------------------------------------------

export function RoutesTab() {
  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Sea distances and days at sea on benchmark routes</caption>
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Via</th>
              <th className="px-3 py-2 text-right font-medium">Distance (nm)</th>
              <th className="px-3 py-2 text-right font-medium">Days at sea</th>
              <th className="px-3 py-2 text-right font-medium">Extra days</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ROUTES.flatMap((route) =>
              route.variants.map((v, i) => (
                <tr key={`${route.id}-${v.via}`} className={cn(i === 0 && "border-t-2")}>
                  <td className="px-3 py-2 align-top">
                    {i === 0 && (
                      <>
                        <p className="font-medium">{route.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {route.origin.name}
                          {route.origin.standsFor && `, for ${route.origin.standsFor}`} →{" "}
                          {route.destination.name}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">{v.via}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(v.nm, 0)}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(v.days, 1)}</td>
                  <td className="px-3 py-2 text-right">
                    {extraDays(route, v) === 0 ? "—" : `+${formatNumber(extraDays(route, v), 1)}`}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Computed, not observed: shortest sea paths on the Eurostat maritime network (searoute), from
        Natural Earth ports; where the export terminal is not in Natural Earth, the nearest listed
        port stands in, as named. Days at sea at {KNOTS.crude} knots for crude tankers and{" "}
        {KNOTS.lng} knots for LNG carriers, laden, with no port time, canal waiting or weather
        margin. Orders of magnitude for comparing routes, not navigation.{" "}
        <Link href="/methodology#freight" className="text-primary underline underline-offset-2">
          Methodology
        </Link>
      </p>
    </div>
  );
}

// Gaps tab -----------------------------------------------------------------------------------------

export function FreightGapsTab() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DECLARED_GAPS.filter((g) => g.markets.includes("freight")).map((gap) => (
        <DataGapNotice key={gap.title} title={gap.title} reason={gap.reason} />
      ))}
    </div>
  );
}
