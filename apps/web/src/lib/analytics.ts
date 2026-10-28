/**
 * Pure calculations on series, shared by KPIs, takeaways and charts. Inputs are points sorted by
 * date; nothing here fills gaps: a missing comparison point gives null, never an estimate.
 */

import type { Points } from "@/lib/data/series";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Latest {
  ts: string;
  value: number;
}

export function latest(points: Points): Latest | null {
  const last = points.at(-1);
  return last ? { ts: last[0], value: last[1] } : null;
}

/**
 * Value at the observation dated exactly `days` before the latest one. Exact date only: a series with
 * a gap on that date has no comparison, so the change is null rather than measured over a
 * different period.
 */
export function valueDaysBefore(points: Points, days: number): number | null {
  const last = latest(points);
  if (!last) return null;
  const target = new Date(Date.parse(last.ts) - days * DAY_MS).toISOString().slice(0, 10);
  const match = points.find(([ts]) => ts.slice(0, 10) === target);
  return match ? match[1] : null;
}

export function changeOverDays(points: Points, days: number): number | null {
  const last = latest(points);
  const before = valueDaysBefore(points, days);
  return last && before !== null ? last.value - before : null;
}

/** Change from the previous observation (e.g. previous trading day for prices). */
export function changeFromPrevious(points: Points): number | null {
  if (points.length < 2) return null;
  return points[points.length - 1][1] - points[points.length - 2][1];
}

/** Share of `history` at or below `value`, in percent (0–100). Null for an empty history. */
export function percentileRank(value: number, history: number[]): number | null {
  if (history.length === 0) return null;
  const atOrBelow = history.filter((v) => v <= value).length;
  return (atOrBelow / history.length) * 100;
}

export type RangePosition = "below" | "within" | "above";

export interface SeasonalComparison {
  current: number;
  mean: number;
  min: number;
  max: number;
  /** current − mean, in the series' unit. */
  deviation: number;
  position: RangePosition;
  yearsCount: number;
}

/** Compare the current value with the five-year norm of the same calendar day. */
export function compareWithSeason(row: {
  current: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  yearsCount: number;
}): SeasonalComparison | null {
  const { current, mean, min, max, yearsCount } = row;
  if (current === null || mean === null || min === null || max === null) return null;
  const position: RangePosition = current < min ? "below" : current > max ? "above" : "within";
  return { current, mean, min, max, deviation: current - mean, position, yearsCount };
}
