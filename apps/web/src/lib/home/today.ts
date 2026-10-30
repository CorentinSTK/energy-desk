/**
 * "Today in energy": short sentences generated from the numbers by explicit rules (BUILD_SPEC §3),
 * never written by hand. Rules, in display order, at most MAX_ITEMS sentences:
 *
 * 1. EU storage against its five-year average for the date (always, when the data exists).
 * 2. Unusual moves: headline series whose latest change is at least MOVE_THRESHOLD standard deviations
 *    of the past year's changes; the largest first, at most two.
 * 3. Extremes: headline series at or beyond the EXTREME_PERCENTILE of their five-year history (high or
 *    low), not already named; the most extreme first, at most two.
 * 4. The storage country furthest from its own five-year average, when at least OUTLIER_PTS away.
 *
 * Ties are broken by the order of HEADLINES, so the same data always gives the same sentences.
 */

import type { Snapshot } from "@/lib/data/snapshot";
import { displayUnit } from "@/lib/display-units";
import { formatDate, formatNumber } from "@/lib/format";

export const MAX_ITEMS = 6;
export const MOVE_THRESHOLD = 2;
export const EXTREME_PERCENTILE = 95;
export const OUTLIER_PTS = 10;
const MAX_PER_RULE = 2;
const MIN_SEASONAL_YEARS = 3;

export interface Headline {
  code: string;
  /** Subject of the sentence, e.g. "Brent spot". */
  label: string;
  decimals: number;
  href: string;
  /** The subject takes a plural verb ("stocks are"). */
  plural?: boolean;
}

export const HEADLINES: Headline[] = [
  { code: "eia.brent_spot", label: "Brent spot", decimals: 2, href: "/markets/crude" },
  { code: "eia.wti_spot", label: "WTI spot", decimals: 2, href: "/markets/crude" },
  {
    code: "yahoo.ttf.front_month",
    label: "The TTF front month (NYMEX, unofficial)",
    decimals: 2,
    href: "/markets/gas",
  },
  {
    code: "smard.de_lu.price_da_base",
    label: "German day-ahead power (base)",
    decimals: 2,
    href: "/markets/power",
  },
  {
    code: "smard.fr.price_da_base",
    label: "French day-ahead power (base)",
    decimals: 2,
    href: "/markets/power?zone=fr",
  },
  {
    code: "elexon.gb.mid_base",
    label: "The GB market index (Elexon MID)",
    decimals: 2,
    href: "/markets/power?zone=gb",
  },
  { code: "eia.henry_hub_spot", label: "Henry Hub spot", decimals: 2, href: "/markets/gas" },
  { code: "alsi.eu.send_out", label: "EU LNG send-out", decimals: 0, href: "/markets/lng" },
  {
    code: "eia.us_crude_stocks",
    label: "US commercial crude stocks",
    plural: true,
    decimals: 1,
    href: "/markets/crude?tab=balance",
  },
  {
    code: "eia.us_distillate_stocks",
    label: "US distillate stocks",
    plural: true,
    decimals: 1,
    href: "/markets/products?tab=balance",
  },
  {
    code: "eia.crack_321_usgc",
    label: "The US Gulf Coast 3-2-1 crack",
    decimals: 2,
    href: "/markets/products",
  },
  {
    code: "ec_wob.eu.diesel.with_tax",
    label: "The EU-average diesel pump price",
    decimals: 3,
    href: "/markets/products",
  },
];

export interface TodayItem {
  text: string;
  href: string;
}

export interface TodayInput {
  snapshots: Map<string, Snapshot>;
  /** Catalogue unit of each series (source unit), for display rescaling. */
  units: Map<string, string>;
  /** Storage filling-level snapshots by country name (agsi.<cc>.full), EU excluded. */
  storage: { name: string; snapshot: Snapshot }[];
  rangeLabel: string;
}

function shown(code: string, value: number, units: Map<string, string>, decimals: number): string {
  const { unit, factor } = displayUnit(units.get(code) ?? "");
  const text = formatNumber(value * factor, decimals);
  return unit === "%" ? `${text}%` : `${text} ${unit}`;
}

function storageGap(s: Snapshot): number | null {
  return s.seasonalMean !== null && s.seasonalYears >= MIN_SEASONAL_YEARS
    ? s.lastValue - s.seasonalMean
    : null;
}

function gapText(gap: number): string {
  return `${formatNumber(Math.abs(gap), 1)} pts ${gap < 0 ? "below" : "above"}`;
}

export function todayInEnergy({ snapshots, units, storage, rangeLabel }: TodayInput): TodayItem[] {
  const items: TodayItem[] = [];

  // 1. EU storage.
  const eu = snapshots.get("agsi.eu.full");
  const euGap = eu ? storageGap(eu) : null;
  if (eu && euGap !== null) {
    items.push({
      text: `EU gas storage is ${formatNumber(eu.lastValue, 1)}% full on ${formatDate(eu.lastTs)}, ${gapText(euGap)} the ${rangeLabel} average for the date.`,
      href: "/markets/gas?tab=storage",
    });
  }

  // 2. Unusual moves.
  const named = new Set<string>();
  const moves = HEADLINES.flatMap((h) => {
    const s = snapshots.get(h.code);
    return s && s.moveZ !== null && s.prevValue !== null && Math.abs(s.moveZ) >= MOVE_THRESHOLD
      ? [{ h, s, z: s.moveZ, prev: s.prevValue }]
      : [];
  })
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, MAX_PER_RULE);
  for (const { h, s, z, prev } of moves) {
    named.add(h.code);
    const change = s.lastValue - prev;
    items.push({
      text: `${h.label} ${change >= 0 ? "rose" : "fell"} ${shown(h.code, Math.abs(change), units, h.decimals)} to ${shown(h.code, s.lastValue, units, h.decimals)} on ${formatDate(s.lastTs)}, an unusually large move (${formatNumber(Math.abs(z), 1)} standard deviations of the past year's changes).`,
      href: h.href,
    });
  }

  // 3. Extremes.
  const extremes = HEADLINES.flatMap((h) => {
    const s = snapshots.get(h.code);
    const p = s?.percentile5y ?? null;
    return s &&
      p !== null &&
      !named.has(h.code) &&
      (p >= EXTREME_PERCENTILE || p <= 100 - EXTREME_PERCENTILE)
      ? [{ h, s, p }]
      : [];
  })
    .sort((a, b) => Math.abs(b.p - 50) - Math.abs(a.p - 50))
    .slice(0, MAX_PER_RULE);
  for (const { h, s, p } of extremes) {
    const side =
      p >= EXTREME_PERCENTILE
        ? `higher than ${formatNumber(Math.floor(p), 0)}% of the past five years' values`
        : `lower than ${formatNumber(Math.floor(100 - p), 0)}% of the past five years' values`;
    items.push({
      text: `${h.label} ${h.plural ? "are" : "is"} ${shown(h.code, s.lastValue, units, h.decimals)} (${formatDate(s.lastTs)}), ${side}.`,
      href: h.href,
    });
  }

  // 4. Storage outlier.
  const outlier = storage
    .map((c) => ({ ...c, gap: storageGap(c.snapshot) }))
    .filter((c): c is typeof c & { gap: number } => c.gap !== null)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
  if (outlier && Math.abs(outlier.gap) >= OUTLIER_PTS) {
    items.push({
      text: `Of ${storage.length} EU countries with storage data, ${outlier.name} is furthest from normal: ${formatNumber(outlier.snapshot.lastValue, 1)}% full on ${formatDate(outlier.snapshot.lastTs)}, ${gapText(outlier.gap)} its ${rangeLabel} average for the date.`,
      href: "/markets/gas?tab=storage",
    });
  }

  return items.slice(0, MAX_ITEMS);
}
