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
import { formatChange, formatDate, formatNumber } from "@/lib/format";
import { BENCHMARKS } from "@/lib/home/benchmarks";
import {
  COUNTRY_CODES,
  countrySeries,
  type HomeState,
  homeHref,
  LAYERS,
  layerSeries,
  METRICS,
  metricText,
  metricValue,
  parseHomeParams,
  VIEWS,
} from "@/lib/home/layers";
import { HEADLINES, todayInEnergy } from "@/lib/home/today";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Energy Desk — European energy markets from free official data",
  description:
    "A map of European gas storage, power prices and pump prices against their five-year norms, the oil benchmarks, and what stands out today.",
};

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Energy Desk</h1>
        <p className="text-text-secondary">
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
      <Controls state={state} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
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
          <EnergyMap state={state} snapshots={snapshots} />
        </ChartCard>
        <Card className="h-fit">
          <CardContent className="space-y-4">
            {selection ? (
              <MapPanel state={state} selection={selection} snapshots={snapshots} ctx={ctx} />
            ) : (
              <p className="text-sm text-text-secondary">
                Select a country or a marker to see its latest values.
              </p>
            )}
            <MapLegend metric={state.metric} view={state.view} />
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
  return (
    <section aria-label="Benchmark prices" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-8">
        {BENCHMARKS.map((b) => {
          const s = snapshots.get(b.code);
          const { unit, factor } = displayUnit(ctx.series.get(b.code)?.unit ?? "");
          const decimals = unit === "€/L" ? 3 : 2;
          const change = s && s.prevValue !== null ? (s.lastValue - s.prevValue) * factor : null;
          return (
            <li key={b.code} className="w-40 lg:w-auto">
              <Link
                href={b.href}
                className="block h-full rounded-lg border bg-card p-3 transition-colors hover:bg-muted"
              >
                <p className="text-xs font-medium">{b.label}</p>
                <p className="mt-1 text-base font-semibold tabular-nums">
                  {s ? formatNumber(s.lastValue * factor, decimals) : "—"}{" "}
                  <span className="text-xs font-normal text-text-secondary">{unit}</span>
                </p>
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    change === null
                      ? "text-muted-foreground"
                      : change >= 0
                        ? "text-positive"
                        : "text-negative",
                  )}
                >
                  {formatChange(change, decimals)} · {s ? formatDate(s.lastTs) : "no data"}
                </p>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{b.kind}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Controls --------------------------------------------------------------------------------------

function Chips<T extends string>({
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
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted-foreground">{label}</span>
      {items.map((item) => (
        <Link
          key={item.id}
          href={hrefFor(item.id)}
          scroll={false}
          aria-current={item.id === active ? "true" : undefined}
          className={cn(
            "rounded-md border px-2.5 py-1 text-sm transition-colors hover:bg-muted",
            item.id === active && "border-primary bg-muted font-medium",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function Controls({ state }: { state: HomeState }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-6">
      <Chips
        label="View"
        items={VIEWS}
        active={state.view}
        hrefFor={(view) => homeHref(state, { view, focus: null })}
      />
      {state.view === "europe" && (
        <Chips
          label="Layer"
          items={LAYERS}
          active={state.layer}
          hrefFor={(layer) => homeHref(state, { layer })}
        />
      )}
      <Chips
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
      <h2 id="today" className="text-lg font-semibold">
        Today in energy
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">Nothing to report: no data yet.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.text}>
              <Link
                href={item.href}
                className="block h-full rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-muted"
              >
                {item.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Generated by fixed rules from the latest data (unusual moves, five-year extremes, storage
        against its seasonal norm); never written by hand.
      </p>
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
  const rows = [...countryRows, ...markerRows];
  return (
    <details className="rounded-lg border">
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
