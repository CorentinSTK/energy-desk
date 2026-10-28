import "server-only";

import { extractionDates } from "@/lib/data/attribution";
import { type CatalogSeries, getRecentRuns, getSeriesCatalog } from "@/lib/data/catalog";
import { describeDatabaseError } from "@/lib/data/errors";

/** Countries with storage series (catalog/gie_agsi.yaml), EU aggregate first. */
export const STORAGE_AREAS = [
  { id: "eu", label: "EU" },
  { id: "de", label: "Germany" },
  { id: "fr", label: "France" },
  { id: "nl", label: "Netherlands" },
  { id: "it", label: "Italy" },
  { id: "at", label: "Austria" },
] as const;
export type StorageArea = (typeof STORAGE_AREAS)[number]["id"];

/** Entry points with flow series (catalog/entsog.yaml), grouped by origin for the legend order. */
export const ENTRY_POINTS = [
  "entsog.dunkerque",
  "entsog.zeebrugge_zpt",
  "entsog.mazara",
  "entsog.almeria",
  "entsog.gela",
  "entsog.melendugno",
  "entsog.strandzha2",
  "entsog.zeebrugge_izt",
  "entsog.bacton_bbl",
] as const;

export const TABS = [
  { id: "prices", label: "Prices & curve" },
  { id: "storage", label: "Balance & stocks" },
  { id: "flows", label: "Flows" },
  { id: "positioning", label: "Positioning" },
  { id: "gaps", label: "Data gaps" },
] as const;
export type GasTab = (typeof TABS)[number]["id"];

/** URL parameters, checked against allow-lists (unknown values fall back to defaults). */
export function parseGasParams(params: Record<string, string | string[] | undefined>): {
  tab: GasTab;
  area: StorageArea;
} {
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "prices";
  const area = STORAGE_AREAS.find((a) => a.id === params.area)?.id ?? "eu";
  return { tab, area };
}

export function gasHref(tab: GasTab, area: StorageArea): string {
  const query = new URLSearchParams();
  if (tab !== "prices") query.set("tab", tab);
  if (area !== "eu") query.set("area", area);
  const text = query.toString();
  return text ? `/markets/gas?${text}` : "/markets/gas";
}

export interface PageContext {
  series: Map<string, CatalogSeries>;
  extractionDates: Record<string, string>;
  now: Date;
  year: number;
  /** e.g. "2021–2025": the five years the seasonal norm uses. */
  rangeLabel: string;
}

/** Catalogue and runs for footers and freshness. Null when the database is unreachable. */
export async function loadContext(now: Date): Promise<PageContext | null> {
  try {
    const [catalog, runs] = await Promise.all([getSeriesCatalog(), getRecentRuns()]);
    const year = now.getUTCFullYear();
    return {
      series: new Map(catalog.map((s) => [s.code, s])),
      extractionDates: extractionDates(runs),
      now,
      year,
      rangeLabel: `${year - 5}–${year - 1}`,
    };
  } catch (error) {
    console.error(`[gas] context query failed: ${describeDatabaseError(error)}`);
    return null;
  }
}

/** Run a query; log and return null on failure so one card fails, not the page. */
export async function attempt<T>(label: string, query: Promise<T>): Promise<T | null> {
  try {
    return await query;
  } catch (error) {
    console.error(`[gas] ${label} failed: ${describeDatabaseError(error)}`);
    return null;
  }
}

/** ISO timestamp `days` before `now`, for query start dates. */
export function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
