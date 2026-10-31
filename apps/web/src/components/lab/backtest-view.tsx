"use client";

import { useMemo } from "react";

import { ChartCard, type ChartSourceInfo } from "@/components/chart-card";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { formatChange, formatDate, formatNumber } from "@/lib/format";
import { runBacktest, type Stats } from "@/lib/lab/backtest";
import { alignSignal, computeIndicator, type Points } from "@/lib/lab/indicators";
import type { Instrument, Rule } from "@/lib/lab/rules";
import { cn } from "@/lib/utils";

const COST_MULTIPLIERS = [0, 1, 2, 4];
/** Below this many trades the Sharpe ratio is shown greyed out as not meaningful. */
const MIN_TRADES_FOR_SHARPE = 20;
const CHART_HEIGHT = 260;

export function indicatorUnit(rule: Rule, signal: Instrument): string {
  switch (rule.indicator.kind) {
    case "zscore":
      return "σ";
    case "percentile":
      return "percentile";
    case "seasonal":
      return "% vs 5-year norm";
    default:
      return signal.unit;
  }
}

interface BacktestViewProps {
  rule: Rule;
  traded: Instrument;
  signal: Instrument;
  tradedPoints: Points;
  signalPoints: Points;
  /** Footers of the official series (source, attribution, last date), from the catalogue. */
  tradedInfo?: ChartSourceInfo;
  signalInfo?: ChartSourceInfo;
}

export function BacktestView({
  rule,
  traded,
  signal,
  tradedPoints,
  signalPoints,
  tradedInfo,
  signalInfo,
}: BacktestViewProps) {
  const result = useMemo(() => {
    const indicator = computeIndicator(signalPoints, rule.indicator);
    const dates = tradedPoints.map(([d]) => d);
    const values = tradedPoints.map(([, v]) => v);
    const aligned = alignSignal(
      dates,
      signalPoints.map(([d]) => d),
      indicator,
      signal.lagDays,
    );
    const runs = COST_MULTIPLIERS.map((k) => runBacktest(dates, values, aligned, rule, k));
    return { aligned, dates, runs };
  }, [rule, signal.lagDays, signalPoints, tradedPoints]);

  if (tradedPoints.length < 2) {
    return <p className="text-sm text-text-secondary">Not enough data for this series.</p>;
  }
  const main = result.runs[1];
  const unit = traded.unit;
  const d = traded.decimals;
  const signalUnit = indicatorUnit(rule, signal);
  const fallback = { source: traded.label, unit };
  const info: ChartSourceInfo = {
    ...(tradedInfo ?? fallback),
    source: `Computed in your browser from ${tradedInfo?.source || traded.label}`,
    unit,
  };
  const signalFooter: ChartSourceInfo = {
    ...(signalInfo ?? { source: signal.label, unit: signalUnit }),
    source: `Computed from ${signalInfo?.source || signal.label}`,
    unit: signalUnit,
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-warning/60 bg-warning/5 p-3 text-sm">
        <p className="font-medium">In-sample research, not a trading recommendation.</p>
        <p className="text-text-secondary">
          The rule is tested on the same history it may have been tuned on: judge it on the control
          period (after {main.splitDate ? formatDate(main.splitDate) : "—"}), which you should not
          have used to choose the settings. P&L is the change of the {traded.label} while the rule
          is in a position, in {unit}
          {traded.codes.length === 2 || traded.id.startsWith("crack")
            ? " — a spot spread is a measure of the signal, not an instrument you can hold"
            : ""}
          . {main.all.trades} trade{main.all.trades === 1 ? "" : "s"} in{" "}
          {formatNumber(main.all.years, 1)} years.
        </p>
      </div>

      <StatsTable runs={result.runs} unit={unit} decimals={d} />

      <ChartCard
        title="Cumulative P&L and drawdown"
        takeaway={`${formatChange(main.all.totalPnl, d)} ${unit} over the whole history at the stated cost; worst drawdown ${formatNumber(main.all.maxDrawdown, d)} ${unit}.`}
        method={
          <p>
            Daily P&L of the position held since the previous close, cumulated; the round-trip cost
            is subtracted on the day each trade closes. Drawdown is the distance below the previous
            peak of the cumulative P&L.
          </p>
        }
        info={info}
        height={CHART_HEIGHT}
      >
        <MultiLineChart
          series={[
            {
              name: "Cumulative P&L",
              data: result.dates.map((t, i) => [t, main.equity[i]]),
              colorIndex: 0,
            },
            {
              name: "Drawdown",
              data: result.dates.map((t, i) => [t, main.drawdown[i]]),
              colorIndex: 1,
            },
          ]}
          unit={unit}
          decimals={d}
          height={CHART_HEIGHT}
          ariaLabel="Cumulative profit and loss and drawdown of the rule"
        />
      </ChartCard>

      <ChartCard
        title="Signal and thresholds"
        method={
          <p>
            The indicator of the signal series on each date of the traded series, as it was known
            then (weekly stocks only from their publication). Horizontal lines are the entry and
            exit thresholds.
          </p>
        }
        info={signalFooter}
        height={CHART_HEIGHT}
      >
        <MultiLineChart
          series={[
            {
              name: "Indicator",
              data: result.dates.map((t, i) => [t, result.aligned[i]]),
              colorIndex: 0,
            },
            {
              name: "Entry",
              data: result.dates.map((t) => [t, rule.entry.threshold]),
              colorIndex: 2,
            },
            ...(rule.exit
              ? [
                  {
                    name: "Exit",
                    data: result.dates.map((t): [string, number] => [t, rule.exit!.threshold]),
                    colorIndex: 3,
                  },
                ]
              : []),
          ]}
          unit={signalUnit}
          decimals={2}
          height={CHART_HEIGHT}
          ariaLabel="Signal indicator with entry and exit thresholds"
        />
      </ChartCard>

      <ChartCard
        title={traded.label}
        method={
          <p>The traded series, as stored (official source, spread computed on common dates).</p>
        }
        info={info}
        height={CHART_HEIGHT}
      >
        <TimeSeriesChart
          name={traded.label}
          commodity={traded.commodity}
          data={tradedPoints}
          unit={unit}
          decimals={d}
          height={CHART_HEIGHT}
          ariaLabel={`${traded.label} history`}
        />
      </ChartCard>

      <details className="rounded-lg border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          Trades ({main.trades.length})
        </summary>
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-1 font-medium">Entry</th>
                <th className="px-3 py-1 font-medium">Exit</th>
                <th className="px-3 py-1 text-right font-medium">Entry level</th>
                <th className="px-3 py-1 text-right font-medium">Exit level</th>
                <th className="px-3 py-1 text-right font-medium">P&L ({unit})</th>
                <th className="px-3 py-1 font-medium">Why it closed</th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {main.trades.map((t) => (
                <tr key={t.entryDate}>
                  <td className="px-3 py-1">{formatDate(t.entryDate)}</td>
                  <td className="px-3 py-1">{formatDate(t.exitDate)}</td>
                  <td className="px-3 py-1 text-right">{formatNumber(t.entryPrice, d)}</td>
                  <td className="px-3 py-1 text-right">{formatNumber(t.exitPrice, d)}</td>
                  <td
                    className={cn(
                      "px-3 py-1 text-right",
                      t.pnl >= 0 ? "text-positive" : "text-negative",
                    )}
                  >
                    {formatChange(t.pnl, d)}
                  </td>
                  <td className="px-3 py-1">{t.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function StatsTable({
  runs,
  unit,
  decimals,
}: {
  runs: ReturnType<typeof runBacktest>[];
  unit: string;
  decimals: number;
}) {
  const main = runs[1];
  const rows: { label: string; stats: Stats; emphasis?: boolean }[] = [
    { label: "Tuning period (first 70%)", stats: main.tuning },
    { label: "Control period (last 30%)", stats: main.control, emphasis: true },
    { label: "Whole history", stats: main.all },
  ];
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Period</th>
              <th className="py-1 pr-3 text-right font-medium">Trades</th>
              <th className="py-1 pr-3 text-right font-medium">Total P&L ({unit})</th>
              <th className="py-1 pr-3 text-right font-medium">Hit rate</th>
              <th className="py-1 pr-3 text-right font-medium">Avg win / loss</th>
              <th className="py-1 pr-3 text-right font-medium">Sharpe</th>
              <th className="py-1 pr-3 text-right font-medium">Max drawdown</th>
              <th className="py-1 pr-3 text-right font-medium">In position</th>
              <th className="py-1 text-right font-medium">Trades / year</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {rows.map(({ label, stats: s, emphasis }) => (
              <tr key={label} className={cn(emphasis && "font-medium")}>
                <td className="py-1 pr-3">{label}</td>
                <td className="py-1 pr-3 text-right">{s.trades}</td>
                <td className="py-1 pr-3 text-right">{formatChange(s.totalPnl, decimals)}</td>
                <td className="py-1 pr-3 text-right">
                  {s.hitRate === null ? "—" : `${formatNumber(s.hitRate, 0)}%`}
                </td>
                <td className="py-1 pr-3 text-right">
                  {formatChange(s.avgWin, decimals)} / {formatChange(s.avgLoss, decimals)}
                </td>
                <td
                  className={cn(
                    "py-1 pr-3 text-right",
                    s.trades < MIN_TRADES_FOR_SHARPE && "text-muted-foreground",
                  )}
                  title={
                    s.trades < MIN_TRADES_FOR_SHARPE
                      ? "Fewer than 20 trades: not meaningful"
                      : undefined
                  }
                >
                  {formatNumber(s.sharpe, 2)}
                  {s.trades < MIN_TRADES_FOR_SHARPE ? "*" : ""}
                </td>
                <td className="py-1 pr-3 text-right">{formatNumber(s.maxDrawdown, decimals)}</td>
                <td className="py-1 pr-3 text-right">{formatNumber(s.exposure, 0)}%</td>
                <td className="py-1 text-right">{formatNumber(s.tradesPerYear, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        * Fewer than {MIN_TRADES_FOR_SHARPE} trades: the Sharpe ratio is not meaningful. Sharpe is
        computed on daily P&L in {unit}, annualised with the series&apos; observations per year.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <caption className="pb-1 text-left text-xs font-medium text-muted-foreground">
            Cost sensitivity (whole history)
          </caption>
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Cost per round trip</th>
              <th className="py-1 pr-3 text-right font-medium">Total P&L ({unit})</th>
              <th className="py-1 text-right font-medium">Sharpe</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {runs.map((run, i) => (
              <tr key={COST_MULTIPLIERS[i]}>
                <td className="py-1 pr-3">{COST_MULTIPLIERS[i]}× the stated cost</td>
                <td className="py-1 pr-3 text-right">{formatChange(run.all.totalPnl, decimals)}</td>
                <td className="py-1 text-right">{formatNumber(run.all.sharpe, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
