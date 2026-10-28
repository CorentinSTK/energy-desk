/**
 * Freshness of a series from the age of its last observation (BUILD_SPEC §2.5).
 *
 * Thresholds allow for normal publication lags: daily data skips weekends and holidays, weekly
 * reports can slip a day or two, monthly data is published weeks after the month ends. They are a
 * first version; M1 can refine them per source once real publication schedules are recorded.
 */

export type Frequency = "hourly" | "daily" | "weekly" | "monthly";
export type FreshnessStatus = "fresh" | "delayed" | "stale";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Maximum age (in days) for each status; older than `delayed` is stale. */
export const FRESHNESS_THRESHOLDS_DAYS: Record<Frequency, { fresh: number; delayed: number }> = {
  hourly: { fresh: 1.5, delayed: 3 }, // day-ahead power is published once a day for the next day
  daily: { fresh: 4, delayed: 7 }, // a long weekend plus one publication day
  weekly: { fresh: 10, delayed: 17 },
  monthly: { fresh: 45, delayed: 75 },
};

export function freshnessStatus(
  lastObservation: Date,
  frequency: Frequency,
  now: Date = new Date(),
): FreshnessStatus {
  const ageDays = (now.getTime() - lastObservation.getTime()) / DAY_MS;
  const limits = FRESHNESS_THRESHOLDS_DAYS[frequency];
  if (ageDays <= limits.fresh) return "fresh";
  if (ageDays <= limits.delayed) return "delayed";
  return "stale";
}
