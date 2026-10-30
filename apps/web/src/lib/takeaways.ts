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

/** Within this relative distance (%) from the five-year mean, a level is "close to the average". */
export const NEAR_AVERAGE_PCT = 5;

/**
 * Rule: level and date, then the relative distance from the five-year mean of the same calendar day
 * ("close to" within NEAR_AVERAGE_PCT), and the range position when outside it.
 */
export function seasonalLevelTakeaway(
  subject: string,
  date: string,
  c: SeasonalComparison,
  unit: string,
  decimals: number,
  rangeLabel: string,
  period: "date" | "week" = "date",
  plural = false,
): string {
  const value = `${formatNumber(c.current, decimals)}${unit === "%" ? "%" : ` ${unit}`}`;
  const level = `${subject} ${plural ? "were" : "was"} ${value} on ${formatDate(date)}`;
  if (c.mean === 0) return `${level}.`;
  const pct = (c.deviation / c.mean) * 100;
  const vsMean =
    Math.abs(pct) < NEAR_AVERAGE_PCT
      ? `close to the ${rangeLabel} average for this ${period}`
      : `${formatNumber(Math.abs(pct), 0)}% ${pct < 0 ? "below" : "above"} the ${rangeLabel} average for this ${period}`;
  const range = c.position === "within" ? "" : `, ${c.position} the ${rangeLabel} range`;
  return `${level}, ${vsMean}${range}.`;
}

/** Below this size (in the spread's unit), a futures spread is "flat". */
export const FLAT_CURVE = 0.05;

/**
 * Rule: the sign of M1 − M2 gives the shape of the prompt curve (|spread| < FLAT_CURVE is flat); the
 * longer spread, when given, says how far the front is above or below the contract a year out.
 */
export function curveTakeaway(
  market: string,
  date: string,
  m1m2: number,
  unit: string,
  m1m12: number | null = null,
): string {
  const prompt = `${formatNumber(Math.abs(m1m2), 2)} ${unit}`;
  const shape =
    Math.abs(m1m2) < FLAT_CURVE
      ? `the ${market} prompt curve is flat`
      : m1m2 > 0
        ? `${market} is in backwardation: the front month is ${prompt} above the second month`
        : `${market} is in contango: the front month is ${prompt} below the second month`;
  const year =
    m1m12 === null
      ? ""
      : ` and ${formatNumber(Math.abs(m1m12), 2)} ${unit} ${m1m12 >= 0 ? "above" : "below"} the twelfth`;
  return `On ${formatDate(date)} ${shape}${year}.`;
}

/** Rule: which of two prices is higher, by how much, on the latest date both have. */
export function spreadTakeaway(
  first: string,
  second: string,
  spread: number,
  unit: string,
  decimals: number,
  date: string,
): string {
  const size = `${formatNumber(Math.abs(spread), decimals)} ${unit}`;
  return spread >= 0
    ? `${first} was ${size} above ${second} on ${formatDate(date)}.`
    : `${first} was ${size} below ${second} on ${formatDate(date)}.`;
}

/**
 * Rule: direction and size of the managed-money net position, its share of open interest, and its
 * percentile over the history shown (how stretched positioning is).
 */
export function positioningTakeaway(
  market: string,
  date: string,
  net: number,
  shareOfOpenInterest: number | null,
  percentile: number | null,
  years: number,
): string {
  const side = net >= 0 ? "net long" : "net short";
  const share =
    shareOfOpenInterest === null
      ? ""
      : ` (${formatNumber(Math.abs(shareOfOpenInterest), 1)}% of open interest)`;
  const rank =
    percentile === null
      ? ""
      : `, the ${formatNumber(percentile, 0)}th percentile of the last ${years} years`;
  return `On ${formatDate(date)} managed money was ${side} ${formatNumber(Math.abs(net), 0)} ${market} contracts${share}${rank}.`;
}

/**
 * Rule: the EU-average pump price and its tax share on the latest bulletin, then the dearest and
 * cheapest member states that reported on that same bulletin date.
 */
export function pumpPriceTakeaway(
  product: string,
  eu: { withTax: number; taxShare: number; date: string },
  dearest: { area: string; withTax: number } | null,
  cheapest: { area: string; withTax: number } | null,
): string {
  const level = `The EU-average ${product} pump price was ${formatNumber(eu.withTax, 3)} €/L on ${formatDate(eu.date)}, ${formatNumber(eu.taxShare, 0)}% of it duties and taxes`;
  if (!dearest || !cheapest) return `${level}.`;
  return `${level}. Dearest: ${dearest.area} (${formatNumber(dearest.withTax, 3)} €/L); cheapest: ${cheapest.area} (${formatNumber(cheapest.withTax, 3)} €/L).`;
}

/** Within this size (mb/d), world supply and demand are "balanced". */
export const BALANCED_MBD = 0.1;

/**
 * Rule: production minus consumption in the latest month both estimates cover; a surplus builds
 * stocks, a deficit draws them (|gap| < BALANCED_MBD is balanced).
 */
export function balanceTakeaway(date: string, production: number, consumption: number): string {
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
  const gap = production - consumption;
  if (Math.abs(gap) < BALANCED_MBD) {
    return `In ${month} world liquids production and consumption were roughly balanced (EIA estimates).`;
  }
  return gap > 0
    ? `In ${month} world production exceeded consumption by ${formatNumber(gap, 1)} mb/d (EIA estimates): stocks were building.`
    : `In ${month} world consumption exceeded production by ${formatNumber(-gap, 1)} mb/d (EIA estimates): stocks were being drawn.`;
}
