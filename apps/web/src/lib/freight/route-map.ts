/**
 * Which benchmark sea routes are open, from measured chokepoint traffic (IMF PortWatch).
 *
 * A chokepoint is "disrupted" when its tanker transits over the latest 7 days are at least
 * DISRUPTED_BELOW_NORM_PCT below the seasonal norm. Measured traffic is used rather than PortWatch's
 * disruption events, because an event can list the detour too (the Red Sea event names the Cape of
 * Good Hope, where traffic went up).
 */

import type { ChokepointId } from "@/lib/freight/chokepoints";
import type { Route, RouteVariant } from "@/lib/freight/routes";

export const DISRUPTED_BELOW_NORM_PCT = 40;

/** searoute passage names → the site's chokepoints (Sunda has no PortWatch series here). */
export const PASSAGE_CHOKEPOINT: Record<string, ChokepointId> = {
  ormuz: "hormuz",
  babalmandab: "bab_el_mandeb",
  suez: "suez",
  south_africa: "cape",
  malacca: "malacca",
  panama: "panama",
  gibraltar: "gibraltar",
};

export function isDisrupted(deviationPct: number | null): boolean {
  return deviationPct !== null && deviationPct <= -DISRUPTED_BELOW_NORM_PCT;
}

/** Disrupted chokepoints a variant passes through. */
export function blockedBy(variant: RouteVariant, disrupted: Set<ChokepointId>): ChokepointId[] {
  return variant.passages.flatMap((p) => {
    const c = PASSAGE_CHOKEPOINT[p];
    return c && disrupted.has(c) ? [c] : [];
  });
}

export type VariantState = "in use" | "alternative" | "disrupted";

/**
 * The variant ships would take: the shortest one that avoids disrupted chokepoints. Variants
 * through a disrupted chokepoint are "disrupted"; the others are alternatives. When every variant
 * is disrupted (e.g. no way around Hormuz), all are shown as disrupted.
 */
export function variantStates(route: Route, disrupted: Set<ChokepointId>): VariantState[] {
  const open = route.variants
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => blockedBy(v, disrupted).length === 0)
    .sort((a, b) => a.v.days - b.v.days);
  const inUse = open[0]?.i;
  return route.variants.map((v, i) =>
    blockedBy(v, disrupted).length > 0 ? "disrupted" : i === inUse ? "in use" : "alternative",
  );
}
