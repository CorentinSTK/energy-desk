/**
 * Statistics on hourly day-ahead prices (SMARD; since October 2025 the hourly value is the mean of
 * four quarter-hour prices). Hours are read in the market's local time zone.
 */

import type { Points } from "@/lib/data/series";

function localParts(ts: string, timeZone: string): { month: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ts));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { month: `${get("year")}-${get("month")}`, hour: Number(get("hour")) };
}

export interface MonthCount {
  /** YYYY-MM, local time. */
  month: string;
  negative: number;
  /** Hours published that month (a month with missing hours is counted on what exists). */
  hours: number;
}

/** Hours with a price below zero, per local calendar month, oldest first. */
export function negativeHoursByMonth(points: Points, timeZone: string): MonthCount[] {
  const byMonth = new Map<string, MonthCount>();
  for (const [ts, value] of points) {
    const { month } = localParts(ts, timeZone);
    const row = byMonth.get(month) ?? { month, negative: 0, hours: 0 };
    row.hours += 1;
    if (value < 0) row.negative += 1;
    byMonth.set(month, row);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Mean price for each local hour of the day (0–23); null for an hour with no value. */
export function hourlyProfile(points: Points, timeZone: string): (number | null)[] {
  const sums = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
  for (const [ts, value] of points) {
    const { hour } = localParts(ts, timeZone);
    sums[hour].sum += value;
    sums[hour].n += 1;
  }
  return sums.map(({ sum, n }) => (n ? sum / n : null));
}
