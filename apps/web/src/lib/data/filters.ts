/**
 * /data filters, read from the URL (shareable state). Values are checked against the allowed lists,
 * so arbitrary query strings are ignored rather than passed anywhere.
 */

export const COMMODITY_FILTERS = ["crude", "natgas", "fx"] as const;
export type CommodityFilter = (typeof COMMODITY_FILTERS)[number];

export const SOURCE_LABELS: Record<string, string> = {
  ecb: "ECB",
  eia: "EIA",
  fred: "FRED",
  gie_agsi: "GIE AGSI+",
};

export interface CatalogFilters {
  commodity?: CommodityFilter;
  source?: string;
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const commodity = typeof params.commodity === "string" ? params.commodity : undefined;
  const source = typeof params.source === "string" ? params.source : undefined;
  return {
    commodity: COMMODITY_FILTERS.find((c) => c === commodity),
    source: source !== undefined && source in SOURCE_LABELS ? source : undefined,
  };
}

/** URL for the /data page with one filter changed (undefined removes it). */
export function filterHref(current: CatalogFilters, change: Partial<CatalogFilters>): string {
  const next = { ...current, ...change };
  const query = new URLSearchParams();
  if (next.commodity) query.set("commodity", next.commodity);
  if (next.source) query.set("source", next.source);
  const text = query.toString();
  return text ? `/data?${text}` : "/data";
}
