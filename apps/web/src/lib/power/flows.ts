/**
 * Net cross-border physical flows (ENTSO-E, daily average MW, positive = first zone exports).
 * Pure helpers for the power page.
 */

import type { Points } from "@/lib/data/series";

export interface Border {
  code: string;
  from: string;
  to: string;
}

const LABELS: Record<string, string> = {
  de_lu: "DE-LU",
  fr: "FR",
  nl: "NL",
  be: "BE",
  at: "AT",
  ch: "CH",
  pl: "PL",
  it_north: "IT-North",
};

/** Borders in catalogue order (worker/catalog/entsoe.yaml). */
export const BORDERS: Border[] = [
  ["fr", "de_lu"],
  ["nl", "de_lu"],
  ["be", "de_lu"],
  ["at", "de_lu"],
  ["ch", "de_lu"],
  ["pl", "de_lu"],
  ["fr", "be"],
  ["nl", "be"],
  ["fr", "ch"],
  ["fr", "it_north"],
  ["ch", "it_north"],
  ["at", "it_north"],
  ["at", "ch"],
].map(([a, b]) => ({ code: `entsoe.flow.${a}_${b}`, from: LABELS[a], to: LABELS[b] }));

/** Mean of the last `days` daily values ending at the latest day; null unless all are present. */
export function trailingMean(points: Points, days: number): { mean: number; asOf: string } | null {
  if (points.length < days) return null;
  const tail = points.slice(-days);
  const last = Date.parse(tail[tail.length - 1][0]);
  const first = Date.parse(tail[0][0]);
  // Consecutive days only: a gap inside the window means the mean would hide missing days.
  if (Math.round((last - first) / 86_400_000) !== days - 1) return null;
  return {
    mean: tail.reduce((sum, [, v]) => sum + v, 0) / days,
    asOf: tail[tail.length - 1][0],
  };
}

/** Exporter and importer of a net flow, from its sign. */
export function direction(border: Border, net: number): { exporter: string; importer: string } {
  return net >= 0
    ? { exporter: border.from, importer: border.to }
    : { exporter: border.to, importer: border.from };
}
