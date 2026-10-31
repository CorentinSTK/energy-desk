import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { BacktestView } from "@/components/lab/backtest-view";
import { ErrorState } from "@/components/error-state";
import { ChartCardSkeleton } from "@/components/loading-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/data/db";
import { getInstrumentPoints } from "@/lib/data/lab";
import { attempt, loadContext, seriesOf } from "@/lib/data/page-context";
import { chartInfo } from "@/lib/data/chart-info";
import { INDICATOR_KINDS } from "@/lib/lab/indicators";
import { INSTRUMENTS, instrument, LIMITS, parseRule, PRESETS, type Rule } from "@/lib/lab/rules";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Rule backtester — Lab — Energy Desk",
  description:
    "Test simple trading rules on energy spreads and prices, with costs, drawdowns and a tuning/control split.",
};

const INDICATOR_LABELS: Record<(typeof INDICATOR_KINDS)[number], string> = {
  value: "Value",
  zscore: "Z-score over N observations",
  percentile: "Percentile over N observations",
  change: "Change over N observations",
  ma_distance: "Distance from N-observation average",
  seasonal: "% from 5-year norm for the week (weekly series)",
};

export default function BacktestPage({ searchParams }: PageProps<"/lab/backtest">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <div className="max-w-3xl space-y-2">
        <p className="text-sm">
          <Link href="/lab" className="text-muted-foreground hover:underline">
            ← Lab
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Rule backtester</h1>
        <p className="text-text-secondary">
          Pick a series to trade, a signal and simple entry and exit rules. Everything runs in your
          browser on official data; the rule is in the URL, so a result can be shared.
        </p>
      </div>
      <Suspense fallback={<ChartCardSkeleton height={320} />}>
        <BacktestContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function BacktestContent({
  searchParams,
}: {
  searchParams: PageProps<"/lab/backtest">["searchParams"];
}) {
  const { preset, rule } = parseRule(await searchParams);
  await connection();
  const traded = instrument(rule.traded);
  const signal = instrument(rule.signal);
  if (!isDatabaseConfigured() || !traded || !signal) {
    return <Unavailable />;
  }
  const [tradedPoints, signalPoints] = await Promise.all([
    attempt(`lab ${traded.id}`, getInstrumentPoints(traded.id)),
    rule.signal === rule.traded
      ? Promise.resolve(null)
      : attempt(`lab ${signal.id}`, getInstrumentPoints(signal.id)),
  ]);
  if (!tradedPoints || (rule.signal !== rule.traded && !signalPoints)) return <Unavailable />;
  const ctx = await loadContext(new Date(), "lab");
  // Footers name the official sources of the series (attribution, last date), not just the Lab.
  const info = (codes: string[], unit: string) =>
    ctx
      ? chartInfo(seriesOf(ctx, ...codes), ctx.extractionDates, ctx.now, { source: "", unit })
      : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Presets active={preset?.id} />
        <RuleForm rule={rule} />
      </div>
      <div className="min-w-0 space-y-3">
        {preset && <p className="text-sm text-text-secondary">{preset.idea}</p>}
        <BacktestView
          rule={rule}
          traded={traded}
          signal={signal}
          tradedPoints={tradedPoints}
          signalPoints={signalPoints ?? tradedPoints}
          tradedInfo={info(traded.codes, traded.unit)}
          signalInfo={info(signal.codes, signal.unit)}
        />
      </div>
    </div>
  );
}

function Unavailable() {
  return (
    <Card>
      <CardContent>
        <ErrorState
          title="The Lab is unavailable"
          description="Our database did not respond. Try again in a few minutes."
        />
      </CardContent>
    </Card>
  );
}

function Presets({ active }: { active?: string }) {
  return (
    <nav aria-label="Presets" className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">Presets</p>
      {PRESETS.map((p) => (
        <Link
          key={p.id}
          href={`/lab/backtest?preset=${p.id}`}
          aria-current={p.id === active ? "true" : undefined}
          className={cn(
            "block rounded-md border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
            p.id === active && "border-primary bg-muted font-medium",
          )}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

const field = "w-full rounded-md border bg-background px-2 py-1 text-sm";
const label = "space-y-1 text-xs text-muted-foreground";

/** A plain GET form: submitting it rewrites the URL, which the server validates (parseRule). */
function RuleForm({ rule }: { rule: Rule }) {
  return (
    <form method="get" action="/lab/backtest" className="space-y-3 rounded-lg border p-3">
      <p className="text-xs font-medium text-muted-foreground">Rule</p>
      <label className={label}>
        Traded series
        <select name="traded" defaultValue={rule.traded} className={field}>
          {INSTRUMENTS.filter((i) => i.tradable).map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Signal series
        <select name="signal" defaultValue={rule.signal} className={field}>
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <label className={label}>
          Indicator
          <select name="ind" defaultValue={rule.indicator.kind} className={field}>
            {INDICATOR_KINDS.map((k) => (
              <option key={k} value={k}>
                {INDICATOR_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          N
          <input
            name="win"
            type="number"
            min={LIMITS.window[0]}
            max={LIMITS.window[1]}
            defaultValue={rule.indicator.window}
            className={field}
          />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className={label}>
          Position
          <select name="side" defaultValue={rule.side} className={field}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label className={label}>
          Enter when
          <select name="eop" defaultValue={rule.entry.op} className={field}>
            <option value="gt">above</option>
            <option value="lt">below</option>
          </select>
        </label>
        <label className={label}>
          Threshold
          <input
            name="eth"
            type="number"
            step="any"
            defaultValue={rule.entry.threshold}
            className={field}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Exit when
          <select name="xop" defaultValue={rule.exit?.op ?? "none"} className={field}>
            <option value="none">no signal exit</option>
            <option value="gt">above</option>
            <option value="lt">below</option>
          </select>
        </label>
        <label className={label}>
          Threshold
          <input
            name="xth"
            type="number"
            step="any"
            defaultValue={rule.exit?.threshold ?? ""}
            className={field}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Max hold (obs.)
          <input
            name="hold"
            type="number"
            min={LIMITS.maxHold[0]}
            max={LIMITS.maxHold[1]}
            defaultValue={rule.maxHold ?? ""}
            placeholder="none"
            className={field}
          />
        </label>
        <label className={label}>
          Cost / round trip
          <input
            name="cost"
            type="number"
            step="any"
            min={0}
            defaultValue={rule.cost}
            className={field}
          />
        </label>
        <label className={label}>
          Stop (loss)
          <input
            name="stop"
            type="number"
            step="any"
            min={0}
            defaultValue={rule.stop ?? ""}
            placeholder="none"
            className={field}
          />
        </label>
        <label className={label}>
          Target (gain)
          <input
            name="target"
            type="number"
            step="any"
            min={0}
            defaultValue={rule.target ?? ""}
            placeholder="none"
            className={field}
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Stop, target and cost are in the traded series&apos; unit. Empty means none.
      </p>
      <button
        type="submit"
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Run backtest
      </button>
    </form>
  );
}
