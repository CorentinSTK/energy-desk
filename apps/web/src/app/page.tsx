import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ChartCard } from "@/components/chart-card";
import { ErrorState } from "@/components/error-state";
import { ChartCardSkeleton, KpiCardSkeleton } from "@/components/loading-skeletons";
import { EnergyMap, viewMarkers } from "@/components/map/energy-map";
import { MapLegend } from "@/components/map/map-legend";
import { MapPanel, resolveSelection } from "@/components/map/map-panel";
import { Card, CardContent } from "@/components/ui/card";
import { chartInfo } from "@/lib/data/chart-info";
import { isDatabaseConfigured } from "@/lib/data/db";
import { attempt, loadContext, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getSnapshots, type Snapshot } from "@/lib/data/snapshot";
import { displayUnit } from "@/lib/display-units";
import { formatChange, formatDate, formatNumber, formatShortDate } from "@/lib/format";
import { BENCHMARKS } from "@/lib/home/benchmarks";
import {
  colorFor,
  COUNTRY_CODES,
  countrySeries,
  type HomeState,
  homeHref,
  LAYERS,
  layerSeries,
  type Metric,
  METRICS,
  metricShort,
  metricText,
  metricValue,
  parseHomeParams,
  VIEWS,
} from "@/lib/home/layers";
import { HEADLINES, todayInEnergy } from "@/lib/home/today";
import { COMMODITIES, commodityOfHref } from "@/lib/commodities";
import { freshnessStatus } from "@/lib/freshness";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Energy Desk — European energy markets from free official data",
  description:
    "A map of European gas storage, power prices and pump prices against their five-year norms, the oil benchmarks, and what stands out today.",
};

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:py-10">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.14em] text-primary uppercase">
          Market overview
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Energy Desk</h1>
        <p className="max-w-2xl text-base text-text-secondary">
          European gas, LNG and power, and global oil, from free official data. Every number links
          to its source.
        </p>
      </div>
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HomeContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const state = parseHomeParams(await searchParams);
  // Request time: freshness and "current year" depend on today, never on the build date.
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "home") : null;
  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Market data is unavailable"
            description={
              isDatabaseConfigured()
                ? "Our database did not respond. Try again in a few minutes."
                : "The database connection is not configured for this deployment."
            }
          />
        </CardContent>
      </Card>
    );
  }

  const selection = resolveSelection(state);
  const markers = viewMarkers(state.view);
  const mapCodes = [
    ...(state.view === "europe" ? layerSeries(state.layer) : []),
    ...markers.flatMap((m) => (m.series ? [m.series] : [])),
  ];
  const storageCodes = layerSeries("storage");
  const codes = [
    ...new Set([
      ...mapCodes,
      ...BENCHMARKS.map((b) => b.code),
      ...HEADLINES.map((h) => h.code),
      ...storageCodes,
      "agsi.eu.full",
      ...(selection?.codes ?? []),
    ]),
  ];
  const snapshots = await attempt("home snapshot", getSnapshots(codes));

  if (!snapshots) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Market data is unavailable"
            description="Our database did not respond. Try again in a few minutes."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <BenchmarkStrip snapshots={snapshots} ctx={ctx} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ChartCard
          title={
            state.view === "europe"
              ? `${LAYERS.find((l) => l.id === state.layer)?.label} across Europe`
              : "Oil and gas benchmarks and chokepoints"
          }
          method={<MapMethod rangeLabel={ctx.rangeLabel} />}
          info={{
            ...chartInfo(seriesOf(ctx, ...mapCodes), ctx.extractionDates, ctx.now, {
              source: "Several",
              unit: "",
            }),
            // Colours show a measure, not the series' own unit.
            unit: METRICS.find((m) => m.id === state.metric)?.label ?? "",
          }}
          height={0}
        >
          <div className="space-y-3">
            <Controls state={state} />
            <div className="overflow-hidden rounded-lg border">
              <EnergyMap state={state} snapshots={snapshots} />
            </div>
            <MapLegend metric={state.metric} view={state.view} />
          </div>
        </ChartCard>
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="space-y-4">
            {selection ? (
              <MapPanel state={state} selection={selection} snapshots={snapshots} ctx={ctx} />
            ) : (
              <MapRanking state={state} snapshots={snapshots} ctx={ctx} />
            )}
          </CardContent>
        </Card>
      </div>
      <TodayInEnergy snapshots={snapshots} ctx={ctx} storageCodes={storageCodes} />
      <MapDataTable state={state} snapshots={snapshots} ctx={ctx} />
    </>
  );
}

// Benchmark strip -------------------------------------------------------------------------------

function BenchmarkStrip({
  snapshots,
  ctx,
}: {
  snapshots: Map<string, Snapshot>;
  ctx: PageContext;
}) {
  const fresh = BENCHMARKS.filter((b) => {
    const meta = ctx.series.get(b.code);
    return (
      meta?.lastObservation &&
      freshnessStatus(
        new Date(meta.lastObservation),
        meta.frequency,
        ctx.now,
        meta.publicationLagDays,
      ) === "fresh"
    );
  }).length;
  return (
    <section aria-label="Benchmark prices" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <h2 className="font-medium tracking-[0.14em] text-text-secondary uppercase">Benchmarks</h2>
        <p className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              fresh === BENCHMARKS.length ? "bg-status-fresh" : "bg-status-delayed",
            )}
            aria-hidden
          />
          {fresh} of {BENCHMARKS.length} fresh · latest published values, source units
        </p>
      </div>
      <div className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max overflow-hidden rounded-xl border bg-card lg:grid lg:min-w-0 lg:grid-cols-8">
          {BENCHMARKS.map((b) => {
            const s = snapshots.get(b.code);
            const { unit, factor } = displayUnit(ctx.series.get(b.code)?.unit ?? "");
            const decimals = unit === "€/L" ? 3 : 2;
            const change = s && s.prevValue !== null ? (s.lastValue - s.prevValue) * factor : null;
            const commodity = commodityOfHref(b.href);
            return (
              <li key={b.code} className="w-40 border-l first:border-l-0 lg:w-auto">
                <Link
                  href={b.href}
                  className="group flex h-full flex-col gap-1 p-3 transition-colors hover:bg-muted"
                >
                  <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    {commodity && (
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          COMMODITIES[commodity].bgClass,
                        )}
                        aria-hidden
                      />
                    )}
                    <span className="truncate group-hover:text-foreground">{b.label}</span>
                  </p>
                  <p className="font-mono text-lg font-semibold tracking-tight tabular-nums">
                    {s ? formatNumber(s.lastValue * factor, decimals) : "—"}{" "}
                    <span className="font-sans text-xs font-normal tracking-normal text-muted-foreground">
                      {unit}
                    </span>
                  </p>
                  <p className="flex items-center justify-between gap-2 text-xs tabular-nums">
                    <span
                      className={cn(
                        "rounded px-1 py-px font-mono",
                        change === null || change === 0
                          ? "bg-muted text-muted-foreground"
                          : change > 0
                            ? "bg-positive/10 text-positive"
                            : "bg-negative/10 text-negative",
                      )}
                    >
                      {formatChange(change, decimals)}
                    </span>
                    <span className="text-muted-foreground">
                      {s ? formatShortDate(s.lastTs, ctx.now) : "no data"}
                    </span>
                  </p>
                  <p className="mt-auto pt-1 text-[11px] leading-tight text-muted-foreground">
                    {b.kind}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// Controls --------------------------------------------------------------------------------------

function Segmented<T extends string>({
  label,
  items,
  active,
  hrefFor,
}: {
  label: string;
  items: readonly { id: T; label: string }[];
  active: T;
  hrefFor: (id: T) => string;
}) {
  return (
    <nav aria-label={label} className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </span>
      <div className="flex w-fit max-w-full overflow-x-auto rounded-lg bg-muted p-0.5">
        {items.map((item) => (
          <Link
            key={item.id}
            href={hrefFor(item.id)}
            scroll={false}
            aria-current={item.id === active ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-xs whitespace-nowrap transition-colors sm:text-sm",
              item.id === active
                ? "bg-surface-raised font-medium text-foreground shadow-sm ring-1 ring-border"
                : "text-text-secondary hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Controls({ state }: { state: HomeState }) {
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
      <Segmented
        label="View"
        items={VIEWS}
        active={state.view}
        hrefFor={(view) => homeHref(state, { view, focus: null })}
      />
      {state.view === "europe" && (
        <Segmented
          label="Layer"
          items={LAYERS}
          active={state.layer}
          hrefFor={(layer) => homeHref(state, { layer })}
        />
      )}
      <Segmented
        label="Measure"
        items={METRICS}
        active={state.metric}
        hrefFor={(metric) => homeHref(state, { metric })}
      />
    </div>
  );
}

function MapMethod({ rangeLabel }: { rangeLabel: string }) {
  return (
    <>
      <p className="font-medium text-foreground">How it is computed</p>
      <p>
        Each country or marker is coloured by its latest observation. vs 5-year average: distance
        from the mean of the same day (weekly series: ISO week) in {rangeLabel}, in % of that mean.
        Latest move: the latest change divided by the standard deviation of the changes over the
        year before it. 5-year percentile: share of the past five years&apos; values at or below the
        latest one.
      </p>
      <p className="font-medium text-foreground">Caveats</p>
      <p>
        Series have different dates (daily, weekly, published with delays): the panel shows each
        date. Gas hubs are virtual trading points drawn at their capital; marker positions are
        approximate (Natural Earth ports and towns). The TTF value is unofficial futures data. No
        value is estimated: missing data is shown as missing.
      </p>
    </>
  );
}

// Default side panel: the map's items ranked by the selected measure --------------------------------

interface MapRow {
  id: string;
  label: string;
  code: string | null;
}

/** Every item the map colours: countries of the layer (Europe view) and the view's markers. */
function mapRows(state: HomeState, ctx: PageContext): MapRow[] {
  const countryRows =
    state.view === "europe"
      ? Object.values(COUNTRY_CODES).flatMap((cc) => {
          const code = countrySeries(state.layer, cc);
          return code ? [{ id: cc, label: ctx.series.get(code)?.region ?? cc, code }] : [];
        })
      : [];
  const markerRows = viewMarkers(state.view).map((m) => ({
    id: m.id,
    label: m.label,
    code: m.series,
  }));
  return [...countryRows, ...markerRows];
}

const RANKING_SIZE = 6;

const RANKING_TITLE: Record<Metric, string> = {
  seasonal: "Furthest from the 5-year average",
  move: "Largest latest moves (σ)",
  percentile: "Most extreme 5-year percentiles",
};

/** Distance from "normal" for a measure: 0 is the norm, larger is more unusual. */
function unusualness(metric: Metric, value: number): number {
  return metric === "percentile" ? Math.abs(value - 50) : Math.abs(value);
}

function MapRanking({
  state,
  snapshots,
  ctx,
}: {
  state: HomeState;
  snapshots: Map<string, Snapshot>;
  ctx: PageContext;
}) {
  // Europe ranks countries (the layer); World ranks its benchmark markers.
  const countries = new Set(Object.values(COUNTRY_CODES));
  const ranked = mapRows(state, ctx)
    .filter((row) => (state.view === "europe") === countries.has(row.id))
    .flatMap((row) => {
      const value = row.code ? metricValue(snapshots.get(row.code), state.metric) : null;
      return value === null ? [] : [{ ...row, value }];
    })
    .sort((a, b) => unusualness(state.metric, b.value) - unusualness(state.metric, a.value))
    .slice(0, RANKING_SIZE);
  return (
    <section aria-labelledby="map-ranking" className="space-y-3">
      <div className="space-y-1">
        <h2 id="map-ranking" className="text-base leading-snug font-medium">
          {RANKING_TITLE[state.metric]}
        </h2>
        <p className="text-xs text-muted-foreground">
          Select a country or a marker to see its latest values.
        </p>
      </div>
      {ranked.length === 0 ? (
        <p className="text-sm text-text-secondary">No data yet for this measure.</p>
      ) : (
        <ol className="divide-y">
          {ranked.map((row) => (
            <li key={row.id}>
              <Link
                href={homeHref(state, { focus: row.id })}
                scroll={false}
                className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted"
              >
                <span
                  className="size-2.5 shrink-0 rounded-sm ring-1 ring-border"
                  style={{ background: colorFor(state.metric, row.value) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="font-mono text-xs text-text-secondary tabular-nums">
                  {metricShort(state.metric, row.value)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// Today in energy -------------------------------------------------------------------------------

function TodayInEnergy({
  snapshots,
  ctx,
  storageCodes,
}: {
  snapshots: Map<string, Snapshot>;
  ctx: PageContext;
  storageCodes: string[];
}) {
  const units = new Map([...ctx.series.values()].map((s) => [s.code, s.unit]));
  const storage = storageCodes.flatMap((code) => {
    const snapshot = snapshots.get(code);
    const name = ctx.series.get(code)?.region;
    return snapshot && name ? [{ name, snapshot }] : [];
  });
  const items = todayInEnergy({ snapshots, units, storage, rangeLabel: ctx.rangeLabel });
  return (
    <section aria-labelledby="today" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="today" className="text-lg font-semibold tracking-tight">
          Today in energy
        </h2>
        <p className="text-xs text-muted-foreground">
          Generated by fixed rules from the latest data (unusual moves, five-year extremes, storage
          against its seasonal norm); never written by hand.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">Nothing to report: no data yet.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const commodity = commodityOfHref(item.href);
            return (
              <li key={item.text}>
                <Link
                  href={item.href}
                  className="group flex h-full flex-col gap-2 rounded-xl border bg-card p-4 text-sm transition-colors hover:border-border-strong hover:bg-muted/50"
                >
                  <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      {commodity && (
                        <span
                          className={cn("size-1.5 rounded-full", COMMODITIES[commodity].bgClass)}
                          aria-hidden
                        />
                      )}
                      {commodity ? COMMODITIES[commodity].label : "Markets"}
                    </span>
                    <ArrowUpRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                      aria-hidden
                    />
                  </span>
                  <span className="leading-relaxed text-foreground">{item.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Map data, as a table -------------------------------------------------------------------------

function MapDataTable({
  state,
  snapshots,
  ctx,
}: {
  state: HomeState;
  snapshots: Map<string, Snapshot>;
  ctx: PageContext;
}) {
  const rows = mapRows(state, ctx);
  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        Map data as a table
      </summary>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">
                {METRICS.find((m) => m.id === state.metric)?.label}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const s = row.code ? snapshots.get(row.code) : undefined;
              return (
                <tr key={row.id}>
                  <td className="px-3 py-1.5">
                    <Link
                      href={homeHref(state, { focus: row.id })}
                      className="underline-offset-2 hover:underline"
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums">{s ? formatDate(s.lastTs) : "—"}</td>
                  <td className="px-3 py-1.5 tabular-nums">
                    {metricText(state.metric, metricValue(s, state.metric))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading market data">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton height={480} />
    </div>
  );
}
