import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ErrorState } from "@/components/error-state";
import { SimulatorView } from "@/components/lab/simulator-view";
import { ChartCardSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/data/db";
import { getInstrumentPoints } from "@/lib/data/lab";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, loadContext, seriesOf } from "@/lib/data/page-context";
import { formatDate, formatNumber } from "@/lib/format";
import { INSTRUMENTS, instrument } from "@/lib/lab/rules";
import { REGIMES } from "@/lib/lab/simulate";
import {
  HORIZON_LIMITS,
  parseSimulator,
  seriesFromParams,
  settingsProblem,
  type SimulatorSettings,
} from "@/lib/lab/simulator-params";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Trade simulator — Lab — Energy Desk",
  description:
    "Monte-Carlo simulation of an entry, a stop and a target on an energy price or spread, by block bootstrap of historical changes.",
};

export default function SimulatorPage({ searchParams }: PageProps<"/lab/simulator">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="max-w-3xl space-y-2">
        <p className="text-sm">
          <Link href="/lab" className="text-muted-foreground hover:underline">
            ← Lab
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Trade simulator</h1>
        <p className="text-text-secondary">
          Choose an entry level, a stop and a target: how often would the order fill, and would the
          target or the stop come first, if the future moved like the past?
        </p>
      </div>
      <Suspense fallback={<ChartCardSkeleton height={320} />}>
        <SimulatorContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SimulatorContent({
  searchParams,
}: {
  searchParams: PageProps<"/lab/simulator">["searchParams"];
}) {
  const params = await searchParams;
  await connection();
  const meta = instrument(seriesFromParams(params));
  const points =
    isDatabaseConfigured() && meta
      ? await attempt(`lab ${meta.id}`, getInstrumentPoints(meta.id))
      : null;
  if (!meta || !points || points.length < 2) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="The simulator is unavailable"
            description="Our database did not respond. Try again in a few minutes."
          />
        </CardContent>
      </Card>
    );
  }
  const settings = parseSimulator(params, points);
  const ctx = await loadContext(new Date(), "lab");
  const sourceInfo = ctx
    ? chartInfo(seriesOf(ctx, ...meta.codes), ctx.extractionDates, ctx.now, {
        source: "",
        unit: meta.unit,
      })
    : undefined;
  const problem = settingsProblem(settings);
  const last = points.at(-1)!;
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        {/* Links, not a form field: another series needs its own default levels. */}
        <nav aria-label="Series" className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Series</p>
          {INSTRUMENTS.filter((i) => i.tradable).map((i) => (
            <Link
              key={i.id}
              href={`/lab/simulator?series=${i.id}`}
              aria-current={i.id === settings.series ? "true" : undefined}
              className={cn(
                "block rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                i.id === settings.series && "border-primary bg-muted font-medium",
              )}
            >
              {i.label}
            </Link>
          ))}
        </nav>
        <SimulatorForm settings={settings} decimals={meta.decimals} />
      </div>
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-text-secondary">
          {meta.label}: last value {formatNumber(last[1], meta.decimals)} {meta.unit} on{" "}
          {formatDate(last[0])}.
        </p>
        {problem ? (
          <p className="rounded-md border border-negative/60 p-3 text-sm text-negative">
            {problem}
          </p>
        ) : (
          <SimulatorView
            settings={settings}
            instrument={meta}
            points={points}
            sourceInfo={sourceInfo}
          />
        )}
      </div>
    </div>
  );
}

const field = "w-full rounded-md border bg-background px-2 py-1 text-sm";
const label = "space-y-1 text-xs text-muted-foreground";

function SimulatorForm({ settings, decimals }: { settings: SimulatorSettings; decimals: number }) {
  const round = (v: number) => Number(v.toFixed(decimals));
  return (
    <form method="get" action="/lab/simulator" className="space-y-3 rounded-lg border p-3">
      <input type="hidden" name="series" value={settings.series} />
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Position
          <select name="side" defaultValue={settings.side} className={field}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label className={label}>
          History
          <select name="regime" defaultValue={settings.regime} className={field}>
            {REGIMES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["entry", "Entry", settings.entry],
            ["stop", "Stop", settings.stop],
            ["target", "Target", settings.target],
          ] as const
        ).map(([name, text, value]) => (
          <label key={name} className={label}>
            {text}
            <input
              name={name}
              type="number"
              step="any"
              defaultValue={round(value)}
              className={field}
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Horizon (obs.)
          <input
            name="horizon"
            type="number"
            min={HORIZON_LIMITS[0]}
            max={HORIZON_LIMITS[1]}
            defaultValue={settings.horizon}
            className={field}
          />
        </label>
        <label className={label}>
          Seed
          <input name="seed" type="number" min={1} defaultValue={settings.seed} className={field} />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Defaults: entry at the last level, stop and target two 20-day standard deviations away.
      </p>
      <button
        type="submit"
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Simulate
      </button>
    </form>
  );
}
