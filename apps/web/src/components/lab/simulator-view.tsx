"use client";

import { useMemo } from "react";

import { ChartCard, type ChartSourceInfo } from "@/components/chart-card";
import { HistogramChart } from "@/components/charts/histogram-chart";
import { formatChange, formatNumber } from "@/lib/format";
import type { Points } from "@/lib/lab/indicators";
import type { Instrument } from "@/lib/lab/rules";
import { histogram, REGIMES, simulate } from "@/lib/lab/simulate";
import { BLOCK_SIZE, PATHS, type SimulatorSettings } from "@/lib/lab/simulator-params";

const BINS = 30;
const HEIGHT = 280;

function pct(x: number): string {
  return `${formatNumber(x * 100, 0)}%`;
}

function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export function SimulatorView({
  settings,
  instrument,
  points,
  sourceInfo,
}: {
  settings: SimulatorSettings;
  instrument: Instrument;
  points: Points;
  /** Footer of the official series (source, attribution, last date), from the catalogue. */
  sourceInfo?: ChartSourceInfo;
}) {
  const result = useMemo(
    () => simulate({ ...settings, points, paths: PATHS, blockSize: BLOCK_SIZE }),
    [settings, points],
  );
  if (!result) {
    return (
      <p className="text-sm text-text-secondary">
        No historical changes in this regime for this series.
      </p>
    );
  }
  const d = instrument.decimals;
  const unit = instrument.unit;
  const sorted = [...result.pnl].sort((a, b) => a - b);
  const bins = histogram(result.pnl, BINS);
  const mean = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null;
  const regime = REGIMES.find((r) => r.id === settings.regime)?.label ?? "";

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-warning/60 bg-warning/5 p-3 text-sm">
        <p className="font-medium">A replay of the past, not a forecast.</p>
        <p className="text-text-secondary">
          {formatNumber(PATHS, 0)} paths of {settings.horizon} observations built from{" "}
          {formatNumber(result.sampleChanges, 0)} historical daily changes ({regime.toLowerCase()}),
          drawn in blocks of {BLOCK_SIZE}. Moves bigger than anything in that sample cannot appear.
          Seed {settings.seed}: the same settings always give the same result.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [
            "Order filled",
            pct(result.filled),
            `entry at ${formatNumber(settings.entry, d)} ${unit}`,
          ],
          ["Target first", pct(result.targetFirst), "of filled paths"],
          ["Stop first", pct(result.stopFirst), "of filled paths"],
          ["Neither by the horizon", pct(result.timedOut), "of filled paths"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            <dd className="text-xs text-muted-foreground">{note}</dd>
          </div>
        ))}
      </dl>
      <ChartCard
        title="Distribution of the trade's P&L"
        takeaway={
          mean !== null
            ? `Mean ${formatChange(mean, d)} ${unit} per filled trade; 5% of paths lose more than ${formatNumber(Math.abs(Math.min(0, quantile(sorted, 0.05) ?? 0)), d)} ${unit}; ${result.meanDaysInTrade === null ? "" : `about ${formatNumber(result.meanDaysInTrade, 0)} observations in the trade on average`}.`
            : undefined
        }
        method={
          <>
            <p>
              Each path starts at the last observed level and adds blocks of consecutive historical
              daily changes from the chosen regime. The order fills the first time a path reaches
              the entry level; the trade then exits at the level of the first day beyond the stop or
              the target (so gaps through a level are included), or at the horizon.
            </p>
            <p>
              Crisis periods: March–June 2020 and 24 February 2022 – June 2023; calm: the rest of
              the history from 2000.
            </p>
          </>
        }
        info={{
          ...(sourceInfo ?? { source: instrument.label, unit }),
          source: `Computed in your browser from ${sourceInfo?.source || instrument.label}`,
          unit,
        }}
        status={result.pnl.length ? "ready" : "empty"}
        height={HEIGHT}
      >
        <HistogramChart
          labels={bins.map((b) => formatNumber((b.from + b.to) / 2, d))}
          counts={bins.map((b) => b.count)}
          negative={bins.map((b) => (b.from + b.to) / 2 < 0)}
          countLabel="paths"
          height={HEIGHT}
          ariaLabel="Histogram of simulated trade profit and loss"
        />
      </ChartCard>
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {[
          ["5th percentile", quantile(sorted, 0.05)],
          ["Median", quantile(sorted, 0.5)],
          ["95th percentile", quantile(sorted, 0.95)],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">
              {formatChange(value as number | null, d)} {unit}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
