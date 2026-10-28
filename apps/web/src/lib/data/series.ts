import "server-only";

import { cacheLife } from "next/cache";

import { db, ISO_UTC } from "./db";

/** [ISO date (UTC), value] pairs, oldest first. */
export type Points = [string, number][];

export interface SeasonalRow {
  /** Day in the fixed non-leap year 2001, as YYYY-MM-DD. */
  day: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  yearsCount: number;
  current: number | null;
}

/** Observations of one series since `fromIso` (inclusive), from web.observations. */
export async function getPoints(code: string, fromIso: string): Promise<Points> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select to_char(ts at time zone 'UTC', ${ISO_UTC}) as ts, value
    from web.observations
    where code = ${code} and ts >= ${fromIso}::timestamptz
    order by ts
  `;
  return rows.map((r) => [r.ts as string, Number(r.value)]);
}

/** Five-year seasonal comparison for a daily series (web.seasonal_daily, migration 002). */
export async function getSeasonal(code: string, year: number): Promise<SeasonalRow[]> {
  "use cache";
  cacheLife("hours");
  const rows = await db()`
    select to_char(day, 'YYYY-MM-DD') as day, min_value, max_value, mean_value, years_count,
           current_value
    from web.seasonal_daily(${code}, ${year})
  `;
  const num = (v: unknown) => (v === null ? null : Number(v));
  return rows.map((r) => ({
    day: r.day as string,
    min: num(r.min_value),
    max: num(r.max_value),
    mean: num(r.mean_value),
    yearsCount: Number(r.years_count),
    current: num(r.current_value),
  }));
}
