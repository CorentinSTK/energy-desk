/**
 * Takeaway sentences under charts (BUILD_SPEC §2.3): computed from the numbers by explicit rules,
 * never written by hand. Each function states its rule; thresholds are named constants.
 */

import type { SeasonalComparison } from "@/lib/analytics";
import { formatDate, formatNumber } from "@/lib/format";

/** Below this distance (in % points) from the five-year mean, storage is "close to the average". */
export const NEAR_AVERAGE_PTS = 2;
/** Below this absolute size (€/MWh), a prompt spread is "flat". */
export const FLAT_SPREAD = 0.1;

/**
 * Rule: state the level and date; say how far from the five-year mean (or "close to" within
 * NEAR_AVERAGE_PTS); add the range position when outside it.
 */
export function storageTakeaway(
  region: string,
  date: string,
  c: SeasonalComparison,
  rangeLabel: string,
): string {
  const level = `${region} gas storage is ${formatNumber(c.current, 1)}% full on ${formatDate(date)}`;
  const gap = Math.abs(c.deviation);
  const vsMean =
    gap < NEAR_AVERAGE_PTS
      ? `close to the ${rangeLabel} average (${formatNumber(c.mean, 1)}%)`
      : `${formatNumber(gap, 1)} pts ${c.deviation < 0 ? "below" : "above"} the ${rangeLabel} average`;
  const range =
    c.position === "within"
      ? ""
      : `, ${c.position} the ${rangeLabel} range (${formatNumber(c.min, 1)}–${formatNumber(c.max, 1)}%)`;
  const thin = c.yearsCount < 5 ? ` Only ${c.yearsCount} prior years have data for this date.` : "";
  return `${level}, ${vsMean}${range}.${thin}`;
}

/** Rule: sign gives the curve shape; |spread| < FLAT_SPREAD is flat. */
export function promptSpreadTakeaway(spread: number, date: string): string {
  const value = `${spread > 0 ? "+" : spread < 0 ? "−" : ""}${formatNumber(Math.abs(spread), 2)} €/MWh`;
  if (Math.abs(spread) < FLAT_SPREAD) {
    return `The TTF front-month spread is ${value} on ${formatDate(date)}: the prompt curve is flat.`;
  }
  return spread > 0
    ? `The TTF front-month spread is ${value} on ${formatDate(date)}: backwardation, next month's gas is dearer than the month after.`
    : `The TTF front-month spread is ${value} on ${formatDate(date)}: contango, next month's gas is cheaper than the month after.`;
}

/** Rule: compare the latest monthly benchmark with the same month a year earlier, when both exist. */
export function monthlyBenchmarkTakeaway(
  latestValue: number,
  latestDate: string,
  yearAgo: number | null,
): string {
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(latestDate));
  const level = `The IMF European gas benchmark averaged ${formatNumber(latestValue, 2)} $/MMBtu in ${month}`;
  if (yearAgo === null || yearAgo === 0) return `${level}.`;
  const change = ((latestValue - yearAgo) / yearAgo) * 100;
  return `${level}, ${formatNumber(Math.abs(change), 0)}% ${change >= 0 ? "higher" : "lower"} than a year earlier.`;
}

/** Rule: latest level and its date, with the unit. Used where no comparison is meaningful. */
export function latestLevelTakeaway(
  name: string,
  value: number,
  unit: string,
  decimals: number,
  date: string,
): string {
  return `${name} was ${formatNumber(value, decimals)} ${unit} on ${formatDate(date)}.`;
}

/**
 * Rule: name the largest entry point on the most recent date that every listed point reported, and
 * its share of the total over those points. Points without a value that day are left out and counted.
 */
export function largestFlowTakeaway(
  date: string,
  flows: { name: string; value: number | null }[],
  unit: string,
): string | null {
  const reported = flows.filter((f): f is { name: string; value: number } => f.value !== null);
  if (reported.length === 0) return null;
  const total = reported.reduce((sum, f) => sum + f.value, 0);
  const top = reported.reduce((a, b) => (b.value > a.value ? b : a));
  const share = total > 0 ? (top.value / total) * 100 : 0;
  const missing = flows.length - reported.length;
  const note =
    missing > 0 ? ` ${missing} point${missing > 1 ? "s" : ""} had no value that day.` : "";
  return `On ${formatDate(date)} the largest of these entry points was ${top.name}, ${formatNumber(top.value, 0)} ${unit} (${formatNumber(share, 0)}% of the points shown).${note}`;
}
