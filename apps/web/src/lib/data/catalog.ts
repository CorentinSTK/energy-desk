import "server-only";

import { cacheLife } from "next/cache";

import type { Frequency } from "@/lib/freshness";

import { db, ISO_UTC } from "./db";

/** One row of `web.series_catalog` (migration 001). Timestamps are ISO strings, UTC. */
export interface CatalogSeries {
  code: string;
  name: string;
  commodity: string;
  region: string;
  unit: string;
  frequency: Frequency;
  source: string;
  sourceRef: string;
  description: string;
  isUnofficial: boolean;
  priceKind: string | null;
  license: string;
  licenseUrl: string | null;
  attribution: string | null;
  publicationLagDays: number;
  observationCount: number;
  firstObservation: string | null;
  lastObservation: string | null;
  gapCount: number;
  largestIntervalDays: number | null;
}

/** One row of `web.ingest_runs_recent`. */
export interface IngestRun {
  id: number;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "ok" | "partial" | "failed" | "skipped";
  rowsWritten: number;
  rowsRejected: number;
  error: string | null;
}

// Data changes a few times a day: cache for an hour (Next.js `hours` profile).

export async function getSeriesCatalog(): Promise<CatalogSeries[]> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select code, name, commodity, region, unit, frequency, source, source_ref, description,
           is_unofficial, price_kind, license, license_url, attribution, publication_lag_days,
           observation_count,
           to_char(first_observation at time zone 'UTC', ${ISO_UTC}) as first_observation,
           to_char(last_observation at time zone 'UTC', ${ISO_UTC}) as last_observation,
           gap_count, largest_interval_days
    from web.series_catalog
    order by commodity, source, code
  `;
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    commodity: r.commodity,
    region: r.region,
    unit: r.unit,
    frequency: r.frequency,
    source: r.source,
    sourceRef: r.source_ref,
    description: r.description,
    isUnofficial: r.is_unofficial,
    priceKind: r.price_kind,
    license: r.license,
    licenseUrl: r.license_url,
    attribution: r.attribution,
    publicationLagDays: r.publication_lag_days,
    observationCount: Number(r.observation_count),
    firstObservation: r.first_observation,
    lastObservation: r.last_observation,
    gapCount: Number(r.gap_count),
    largestIntervalDays: r.largest_interval_days === null ? null : Number(r.largest_interval_days),
  }));
}

export async function getRecentRuns(limit = 50): Promise<IngestRun[]> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select id, source,
           to_char(started_at at time zone 'UTC', ${ISO_UTC}) as started_at,
           to_char(finished_at at time zone 'UTC', ${ISO_UTC}) as finished_at,
           status, rows_written, rows_rejected, error
    from web.ingest_runs_recent
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    source: r.source,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    status: r.status,
    rowsWritten: r.rows_written,
    rowsRejected: r.rows_rejected,
    error: r.error,
  }));
}
