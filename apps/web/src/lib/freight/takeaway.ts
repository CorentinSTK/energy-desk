/**
 * The freight page's headline sentence, from each chokepoint's latest 7-day mean of tanker transits
 * against its seasonal norm (rolling.ts). Rule: name the chokepoints furthest below and above their
 * norm when they are at least UNUSUAL_PCT away; otherwise say all are near normal.
 */

import { formatDate, formatNumber } from "@/lib/format";

import type { WeekVsSeason } from "./rolling";

export const UNUSUAL_PCT = 25;

export interface ChokepointWeek extends WeekVsSeason {
  label: string;
}

function describe(c: ChokepointWeek, rangeLabel: string): string {
  const pct = c.deviationPct ?? 0;
  return `${c.label} ${formatNumber(c.value, 1)} a day, ${formatNumber(Math.abs(pct), 0)}% ${pct < 0 ? "below" : "above"} its ${rangeLabel} norm`;
}

export function chokepointTakeaway(
  weeks: ChokepointWeek[],
  rangeLabel: string,
): string | undefined {
  const known = weeks.filter((w) => w.deviationPct !== null);
  if (known.length === 0) return undefined;
  const asOf = known.map((w) => w.asOf).sort()[0];
  const lowest = known.reduce((a, b) => ((b.deviationPct ?? 0) < (a.deviationPct ?? 0) ? b : a));
  const highest = known.reduce((a, b) => ((b.deviationPct ?? 0) > (a.deviationPct ?? 0) ? b : a));
  const parts = [lowest, highest]
    .filter((w, i, all) => Math.abs(w.deviationPct ?? 0) >= UNUSUAL_PCT && all.indexOf(w) === i)
    .map((w) => describe(w, rangeLabel));
  const period = `In the 7 days to ${formatDate(asOf)}`;
  if (parts.length === 0) {
    return `${period}, tanker transits were within ${UNUSUAL_PCT}% of their ${rangeLabel} norm at every chokepoint shown.`;
  }
  return `${period}, tanker transits averaged: ${parts.join("; ")}.`;
}
