import "server-only";

import { cacheLife } from "next/cache";

import { db, ISO_UTC } from "./db";

/** One series summarised by web.series_snapshot (migration 006). Null = not enough data. */
export interface Snapshot {
  code: string;
  frequency: string;
  lastTs: string;
  lastValue: number;
  prevTs: string | null;
  prevValue: number | null;
  /** Latest change in standard deviations of the past year's changes. */
  moveZ: number | null;
  /** Share of the past five years' observations at or below the latest value (0–100). */
  percentile5y: number | null;
  historyCount: number;
  /** Mean of the same day / ISO week / month in the five prior years. */
  seasonalMean: number | null;
  seasonalYears: number;
  /** (latest − seasonal mean) / |seasonal mean| × 100. */
  seasonalDeviationPct: number | null;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Latest-value measures for several series at once, keyed by code. Series without data are absent. */
export async function getSnapshots(codes: string[]): Promise<Map<string, Snapshot>> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select code, frequency,
           to_char(last_ts at time zone 'UTC', ${ISO_UTC}) as last_ts, last_value,
           to_char(prev_ts at time zone 'UTC', ${ISO_UTC}) as prev_ts, prev_value,
           move_z, percentile_5y, history_count, seasonal_mean, seasonal_years,
           seasonal_deviation_pct
    from web.series_snapshot(${codes}::text[])
  `;
  return new Map(
    rows.map((r) => [
      r.code as string,
      {
        code: r.code as string,
        frequency: r.frequency as string,
        lastTs: r.last_ts as string,
        lastValue: Number(r.last_value),
        prevTs: (r.prev_ts as string | null) ?? null,
        prevValue: num(r.prev_value),
        moveZ: num(r.move_z),
        percentile5y: num(r.percentile_5y),
        historyCount: Number(r.history_count ?? 0),
        seasonalMean: num(r.seasonal_mean),
        seasonalYears: Number(r.seasonal_years ?? 0),
        seasonalDeviationPct: num(r.seasonal_deviation_pct),
      },
    ]),
  );
}
