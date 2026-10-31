/**
 * Trade simulator: paths of a series built by block bootstrap of its own historical daily changes.
 *
 * Blocks of consecutive changes (not single days) are drawn so that runs of volatility and trends
 * survive. Changes come from the chosen regime only. The generator is seeded, so the same inputs
 * always give the same result. Limits: the past is replayed, so a move larger than anything in the
 * sample cannot appear, and levels are not mean-reverting unless the history was.
 */

import type { Points } from "./indicators";

export const REGIMES = [
  { id: "full", label: "Full history" },
  { id: "crisis", label: "Crisis periods" },
  { id: "calm", label: "Calm periods" },
] as const;
export type Regime = (typeof REGIMES)[number]["id"];

/** Crisis periods, inclusive: the COVID crash and the European energy crisis. */
export const CRISIS_PERIODS: [string, string][] = [
  ["2020-03-01", "2020-06-30"],
  ["2022-02-24", "2023-06-30"],
];

export interface SimulationInput {
  points: Points;
  regime: Regime;
  side: "long" | "short";
  /** Level at which the order fills (the first time a path touches it). */
  entry: number;
  stop: number;
  target: number;
  /** Observations simulated. */
  horizon: number;
  paths: number;
  blockSize: number;
  seed: number;
}

export interface SimulationResult {
  start: number;
  sampleChanges: number;
  filled: number;
  /** Among filled paths: share that hit the target first, the stop first, or neither by the horizon. */
  targetFirst: number;
  stopFirst: number;
  timedOut: number;
  /** P&L of each filled path, exiting at the level of the day the stop or target is crossed (gaps
   * included) or at the horizon, in the series' unit. */
  pnl: number[];
  /** Mean observations from fill to exit. */
  meanDaysInTrade: number | null;
}

/** Mulberry32: a small, fast, seeded pseudo-random generator (deterministic for a given seed). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inCrisis(day: string): boolean {
  return CRISIS_PERIODS.some(([from, to]) => day >= from && day <= `${to}T23:59:59Z`);
}

/**
 * Daily changes whose two observations both belong to the regime, as runs of consecutive changes
 * (a run breaks where the regime changes), so blocks never join two separate periods.
 */
export function regimeRuns(points: Points, regime: Regime): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const [d0, v0] = points[i - 1];
    const [d1, v1] = points[i];
    const keep =
      regime === "full" ||
      (regime === "crisis" ? inCrisis(d0) && inCrisis(d1) : !inCrisis(d0) && !inCrisis(d1));
    if (keep) {
      run.push(v1 - v0);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs;
}

export function simulate(input: SimulationInput): SimulationResult | null {
  const start = input.points.at(-1)?.[1];
  const runs = regimeRuns(input.points, input.regime).filter((r) => r.length >= 1);
  const sampleChanges = runs.reduce((a, r) => a + r.length, 0);
  if (start === undefined || sampleChanges === 0) return null;
  const random = mulberry32(input.seed);
  const sign = input.side === "long" ? 1 : -1;
  // Picking a run in proportion to its length, then a block start within it, draws every change
  // with the same probability.
  const cumulative: number[] = [];
  runs.reduce((acc, r) => {
    cumulative.push(acc + r.length);
    return acc + r.length;
  }, 0);

  const nextBlock = (): number[] => {
    const pick = random() * sampleChanges;
    const run = runs[cumulative.findIndex((c) => pick < c)];
    const from = Math.floor(random() * run.length);
    return run.slice(from, from + input.blockSize);
  };

  let filled = 0;
  let targetFirst = 0;
  let stopFirst = 0;
  let timedOut = 0;
  let daysInTrade = 0;
  const pnl: number[] = [];
  const touches = (previous: number, level: number, current: number) =>
    (previous - level) * (current - level) <= 0;

  for (let p = 0; p < input.paths; p++) {
    let level = start;
    let fillDay: number | null = level === input.entry ? 0 : null;
    let outcome: number | null = null;
    let day = 0;
    while (day < input.horizon && outcome === null) {
      for (const change of nextBlock()) {
        if (day >= input.horizon || outcome !== null) break;
        const previous = level;
        level += change;
        day += 1;
        if (fillDay === null) {
          if (touches(previous, input.entry, level)) fillDay = day;
          continue;
        }
        // Prices are observed once a day: the exit is at that day's level, which may be beyond the
        // stop or target (a gap), never at the stop or target level itself.
        if (sign * (level - input.stop) <= 0) {
          outcome = sign * (level - input.entry);
          stopFirst++;
        } else if (sign * (level - input.target) >= 0) {
          outcome = sign * (level - input.entry);
          targetFirst++;
        }
        if (outcome !== null) daysInTrade += day - fillDay;
      }
    }
    if (fillDay === null) continue;
    filled++;
    if (outcome === null) {
      outcome = sign * (level - input.entry);
      timedOut++;
      daysInTrade += day - fillDay;
    }
    pnl.push(outcome);
  }
  return {
    start,
    sampleChanges,
    filled: filled / input.paths,
    targetFirst: filled ? targetFirst / filled : 0,
    stopFirst: filled ? stopFirst / filled : 0,
    timedOut: filled ? timedOut / filled : 0,
    pnl,
    meanDaysInTrade: filled ? daysInTrade / filled : null,
  };
}

export interface Bin {
  from: number;
  to: number;
  count: number;
}

/** Equal-width bins between the minimum and maximum (the last bin includes the maximum). */
export function histogram(values: number[], bins: number): Bin[] {
  if (values.length === 0) return [];
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (low === high) return [{ from: low, to: high, count: values.length }];
  const width = (high - low) / bins;
  const out: Bin[] = Array.from({ length: bins }, (_, i) => ({
    from: low + i * width,
    to: low + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) out[Math.min(bins - 1, Math.floor((v - low) / width))].count += 1;
  return out;
}
