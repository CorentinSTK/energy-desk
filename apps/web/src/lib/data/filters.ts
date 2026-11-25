/**
 * /data filters and page, read from the URL (shareable state). Values are checked against the allowed
 * lists, so arbitrary query strings are ignored rather than passed anywhere.
 */

export const COMMODITY_FILTERS = [
  "crude",
  "products",
  "lpg",
  "natgas",
  "lng",
  "power",
  "freight",
  "fx",
] as const;
export type CommodityFilter = (typeof COMMODITY_FILTERS)[number];

export const SOURCE_LABELS: Record<string, string> = {
  cftc: "CFTC",
  ec_wob: "European Commission",
  ecb: "ECB",
  eia: "EIA",
  elexon: "Elexon",
  entsog: "ENTSOG",
  fred: "FRED",
  gie_agsi: "GIE AGSI+",
  gie_alsi: "GIE ALSI",
  odre: "RTE éCO2mix",
  portwatch: "IMF PortWatch",
  open_meteo: "Open-Meteo (France)",
  open_meteo_de: "Open-Meteo (Germany)",
  smard: "SMARD",
  yahoo: "Yahoo Finance",
};

/** Series per catalogue page: the full table (300+ rows) made /data heavy to load and to scan. */
export const PAGE_SIZE = 50;
/** Highest page number accepted from the URL; real values are far lower and are clamped later. */
const MAX_PAGE = 1000;

export interface CatalogFilters {
  commodity?: CommodityFilter;
  source?: string;
  /** 1-based; absent means the first page. */
  page?: number;
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const commodity = typeof params.commodity === "string" ? params.commodity : undefined;
  const source = typeof params.source === "string" ? params.source : undefined;
  const page =
    typeof params.page === "string" && /^\d{1,4}$/.test(params.page) ? Number(params.page) : 0;
  return {
    commodity: COMMODITY_FILTERS.find((c) => c === commodity),
    source: source !== undefined && source in SOURCE_LABELS ? source : undefined,
    page: page >= 2 && page <= MAX_PAGE ? page : undefined,
  };
}

/**
 * URL for the /data page with one filter changed (undefined removes it). Changing a filter goes back
 * to the first page, since the old page number belongs to a different list.
 */
export function filterHref(current: CatalogFilters, change: Partial<CatalogFilters>): string {
  const next = { ...current, ...change };
  if (!("page" in change)) next.page = undefined;
  const query = new URLSearchParams();
  if (next.commodity) query.set("commodity", next.commodity);
  if (next.source) query.set("source", next.source);
  if (next.page && next.page > 1) query.set("page", String(next.page));
  const text = query.toString();
  return text ? `/data?${text}` : "/data";
}

export interface Page<T> {
  items: T[];
  /** 1-based, clamped to the pages that exist. */
  page: number;
  pageCount: number;
  /** 1-based position of the first and last item shown (0 and 0 when empty). */
  from: number;
  to: number;
  total: number;
}

/** One page of `items`. A page past the end shows the last page rather than an empty table. */
export function paginate<T>(items: T[], requested = 1, size = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(Math.max(1, requested), pageCount);
  const start = (page - 1) * size;
  const shown = items.slice(start, start + size);
  return {
    items: shown,
    page,
    pageCount,
    from: shown.length ? start + 1 : 0,
    to: start + shown.length,
    total: items.length,
  };
}
