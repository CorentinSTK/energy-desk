/**
 * EU gas storage filling target (Regulation (EU) 2017/1938 as amended by Regulation (EU) 2025/1733,
 * per the European Commission's gas storage page, read 2026-11-25): 90 % to be reached at any time
 * between 1 October and 1 December each year, 2025 to 2027. Countries may deviate in difficult market
 * conditions or under technical constraints, and the Commission may lower the target; neither can be
 * read from filling data, so this module measures filling against 90 % and never judges compliance.
 */

import type { Points } from "@/lib/data/series";

export const TARGET_PCT = 90;

export interface TargetWindow {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
  open: boolean;
}

/** The window of the current gas year: this year's from 1 October, otherwise last year's. */
export function targetWindow(now: Date): TargetWindow {
  const y = now.getUTCFullYear();
  const year = now.getUTCMonth() >= 9 ? y : y - 1; // month 9 = October
  const start = `${year}-10-01`;
  const end = `${year}-12-01`;
  const today = now.toISOString().slice(0, 10);
  return { start, end, open: today >= start && today <= end };
}

export interface WindowResult {
  /** Highest filling level published inside the window so far. */
  peak: number;
  peakDate: string;
  /** First day at or above the target inside the window, if any. */
  reachedOn: string | null;
  days: number;
}

export function windowResult(points: Points, window: TargetWindow): WindowResult | null {
  const inside = points.filter(([ts]) => {
    const day = ts.slice(0, 10);
    return day >= window.start && day <= window.end;
  });
  if (inside.length === 0) return null;
  let [peakDate, peak] = inside[0];
  for (const [ts, v] of inside) if (v > peak) [peakDate, peak] = [ts, v];
  const reached = inside.find(([, v]) => v >= TARGET_PCT);
  return {
    peak,
    peakDate: peakDate.slice(0, 10),
    reachedOn: reached ? reached[0].slice(0, 10) : null,
    days: inside.length,
  };
}
