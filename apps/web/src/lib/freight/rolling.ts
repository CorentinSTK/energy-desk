/**
 * Daily transit counts are noisy (one convoy more or less moves a day by 20 %), so the freight page
 * reads them as 7-day means. A mean is computed only over 7 consecutive calendar days that are all
 * present: a missing day leaves the mean out rather than averaging fewer days (nothing is filled).
 */

import type { Points, SeasonalRow } from "@/lib/data/series";

export const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 7-day trailing means, dated on the window's last day, where the window is complete. */
export function rollingMean(points: Points, window = WINDOW_DAYS): Points {
  const byDay = new Map(points.map(([ts, v]) => [Date.parse(ts), v]));
  const out: Points = [];
  for (const [ts] of points) {
    const end = Date.parse(ts);
    let sum = 0;
    let complete = true;
    for (let i = 0; i < window; i++) {
      const v = byDay.get(end - i * DAY_MS);
      if (v === undefined) {
        complete = false;
        break;
      }
      sum += v;
    }
    if (complete) out.push([ts, sum / window]);
  }
  return out;
}

/**
 * One point per `step` days, counted back from the last point: applied to 7-day means with step 7,
 * this gives non-overlapping weekly means ending on the latest published day.
 */
export function everyNthDay(points: Points, step = WINDOW_DAYS): Points {
  const last = points.at(-1);
  if (!last) return [];
  const end = Date.parse(last[0]);
  return points.filter(([ts]) => Math.round((end - Date.parse(ts)) / DAY_MS) % step === 0);
}

export interface WeekVsSeason {
  /** Mean of the last 7 observed days. */
  value: number;
  /** Mean of the seasonal (5-year) means over the same 7 calendar days. */
  normal: number;
  /** (value − normal) / normal × 100; null when the normal is 0. */
  deviationPct: number | null;
  /** Last day of the window. */
  asOf: string;
}

/**
 * The latest complete 7-day mean against the same 7 calendar days of the seasonal norm
 * (web.seasonal_daily: mean of the same day in the five previous years). Null when either side
 * lacks a day.
 */
export function weekVsSeason(points: Points, seasonal: SeasonalRow[]): WeekVsSeason | null {
  const means = rollingMean(points);
  const last = means.at(-1);
  if (!last) return null;
  const end = Date.parse(last[0]);
  const byMonthDay = new Map(seasonal.map((r) => [r.day.slice(5, 10), r.mean]));
  let normalSum = 0;
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const mean = byMonthDay.get(new Date(end - i * DAY_MS).toISOString().slice(5, 10));
    if (mean === null || mean === undefined) return null;
    normalSum += mean;
  }
  const normal = normalSum / WINDOW_DAYS;
  return {
    value: last[1],
    normal,
    deviationPct: normal === 0 ? null : ((last[1] - normal) / normal) * 100,
    asOf: last[0],
  };
}
