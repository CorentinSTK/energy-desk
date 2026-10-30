/**
 * Calculations for the crude and products pages. Inputs are stored series; every result is a
 * documented computation on values of the same date (no carry-forward, no interpolation).
 */

import type { Points } from "@/lib/data/series";
import { differenceOnDates } from "@/lib/points";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far back a "week earlier" or "month earlier" curve may fall to find a trading day. */
export const CURVE_LOOKBACK_DAYS = 4;

/** The ISO timestamp `days` before `ts`, in the stored format ("2026-10-22T00:00:00Z"). */
export function isoDaysBefore(ts: string, days: number): string {
  return new Date(Date.parse(ts) - days * DAY_MS).toISOString().replace(".000Z", "Z");
}

/**
 * Latest date at or before `target` on which `points` has a value, within `maxDaysBack`. Used to
 * pick the trading day behind "a week earlier" (weekends, holidays); the chart names the actual
 * date, so nothing is relabelled.
 */
export function dateOnOrBefore(points: Points, target: string, maxDaysBack: number): string | null {
  const limit = Date.parse(target) - maxDaysBack * DAY_MS;
  for (let i = points.length - 1; i >= 0; i--) {
    const ts = points[i][0];
    if (ts <= target) return Date.parse(ts) >= limit ? ts : null;
  }
  return null;
}

/**
 * Curve shape relative to the front month on one date, from stored spreads M1 − Mn (n = 2, 3, …):
 * [0, M2 − M1, M3 − M1, …]. A downward line is backwardation. Null when no spread has that date.
 */
export function curveRelativeToFront(spreads: Points[], date: string): (number | null)[] | null {
  const values = spreads.map((s) => {
    const point = s.find(([ts]) => ts === date);
    return point ? -point[1] : null;
  });
  return values.some((v) => v !== null) ? [0, ...values] : null;
}

/** Net position (long − short) per report date: only dates where both were reported. */
export function netPosition(long: Points, short: Points): Points {
  return differenceOnDates(long, short);
}

/** `part` as a percentage of `whole` on the same dates (e.g. net position / open interest). */
export function percentOf(part: Points, whole: Points): Points {
  const byDate = new Map(whole);
  return part.flatMap(([date, value]): Points => {
    const total = byDate.get(date);
    return total !== undefined && total > 0 ? [[date, (value / total) * 100]] : [];
  });
}

export interface PumpPrice {
  area: string;
  date: string;
  withTax: number;
  beforeTax: number;
  /** withTax − beforeTax: duties and taxes, same bulletin date. */
  taxes: number;
  /** taxes as a percentage of withTax. */
  taxShare: number;
}

/**
 * Latest bulletin price of one area with its tax component. Both prices must come from the same
 * bulletin date; otherwise the area has no value rather than a mismatched split.
 */
export function pumpPrice(area: string, withTax: Points, beforeTax: Points): PumpPrice | null {
  const last = withTax.at(-1);
  if (!last) return null;
  const [date, total] = last;
  const before = beforeTax.find(([ts]) => ts === date)?.[1];
  if (before === undefined || total <= 0) return null;
  const taxes = total - before;
  return { area, date, withTax: total, beforeTax: before, taxes, taxShare: (taxes / total) * 100 };
}
