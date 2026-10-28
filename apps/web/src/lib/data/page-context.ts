import "server-only";

import { extractionDates } from "@/lib/data/attribution";
import { type CatalogSeries, getRecentRuns, getSeriesCatalog } from "@/lib/data/catalog";
import { describeDatabaseError } from "@/lib/data/errors";

/** What every market page needs besides its own series: catalogue, footers, current year. */
export interface PageContext {
  series: Map<string, CatalogSeries>;
  extractionDates: Record<string, string>;
  now: Date;
  year: number;
  /** e.g. "2021–2025": the five years the seasonal norm uses. */
  rangeLabel: string;
}

/** Catalogue and runs for footers and freshness. Null when the database is unreachable. */
export async function loadContext(now: Date, page: string): Promise<PageContext | null> {
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
    console.error(`[${page}] context query failed: ${describeDatabaseError(error)}`);
    return null;
  }
}

/** Run a query; log and return null on failure so one card fails, not the page. */
export async function attempt<T>(label: string, query: Promise<T>): Promise<T | null> {
  try {
    return await query;
  } catch (error) {
    console.error(`[data] ${label} failed: ${describeDatabaseError(error)}`);
    return null;
  }
}

/** ISO timestamp `days` before `now`, for query start dates. */
export function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Catalogue entries for these codes, in order, skipping unknown codes. */
export function seriesOf(ctx: PageContext, ...codes: string[]): CatalogSeries[] {
  return codes.map((c) => ctx.series.get(c)).filter((s) => s !== undefined);
}
