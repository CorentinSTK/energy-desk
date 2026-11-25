/**
 * Market coupling between bidding zones, from hourly day-ahead prices.
 *
 * In the single European day-ahead auction (SDAC), zones get the same price when the borders between
 * them are not congested; congestion opens a price gap. The mean absolute hourly gap measures how far
 * apart two zones trade (lower = more integrated). Exactly equal hourly prices are also counted, but
 * since the auction moved to 15-minute products (October 2025) an hourly value averages four prices
 * and is rarely equal to the cent, so the gap is the main measure. Only hours where both zones are
 * published count; missing hours are never filled.
 */

import type { Points } from "@/lib/data/series";

/** Prices are published to the cent: closer than this, two zones had the same price. */
export const SAME_PRICE_EPSILON = 0.005;

export interface CouplingCell {
  /** Hours where both zones are published. */
  hours: number;
  /** Share of those hours with the same price, 0 to 1; null without common hours. */
  sameShare: number | null;
  /** Mean of |price A − price B| over those hours, €/MWh; null without common hours. */
  meanAbsSpread: number | null;
}

export function couplingCell(a: Points, b: Points): CouplingCell {
  const byTs = new Map(a);
  let hours = 0;
  let same = 0;
  let absSum = 0;
  for (const [ts, vb] of b) {
    const va = byTs.get(ts);
    if (va === undefined) continue;
    hours += 1;
    const gap = Math.abs(va - vb);
    if (gap < SAME_PRICE_EPSILON) same += 1;
    absSum += gap;
  }
  return {
    hours,
    sameShare: hours ? same / hours : null,
    meanAbsSpread: hours ? absSum / hours : null,
  };
}

/** Symmetric matrix of cells, in the order of `zones`; the diagonal is null. */
export function couplingMatrix(zones: Points[]): (CouplingCell | null)[][] {
  return zones.map((a, i) => zones.map((b, j) => (i === j ? null : couplingCell(a, b))));
}

/** Upper edges of the gap bins, €/MWh: under 5, 5–15, 15–30, 30–60, 60 and more. */
export const GAP_EDGES = [5, 15, 30, 60];

/** Colour bin (5 = closest prices … 1 = furthest apart) of a mean absolute gap in €/MWh. */
export function gapBin(gap: number): number {
  return 5 - GAP_EDGES.filter((edge) => gap >= edge).length;
}
