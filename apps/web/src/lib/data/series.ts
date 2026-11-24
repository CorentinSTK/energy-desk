import "server-only";

import { cacheLife } from "next/cache";

import { ISO_UTC } from "./db";
import { query } from "./query";

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
  const rows = await query(
    "getPoints",
    (sql) => sql`
    select to_char(ts at time zone 'UTC', ${ISO_UTC}) as ts, value
    from web.observations
    where code = ${code} and ts >= ${fromIso}::timestamptz
    order by ts
  `,
  );
  return rows.map((r) => [r.ts as string, Number(r.value)]);
}

/** Observations of several series since `fromIso`, in one query (for tables of many series). */
export async function getPointsMany(
  codes: string[],
  fromIso: string,
): Promise<Map<string, Points>> {
  "use cache";
  cacheLife("hours");
  const rows = await query(
    "getPointsMany",
    (sql) => sql`
    select code, to_char(ts at time zone 'UTC', ${ISO_UTC}) as ts, value
    from web.observations
    where code = any(${codes}) and ts >= ${fromIso}::timestamptz
    order by code, ts
  `,
  );
  const byCode = new Map<string, Points>(codes.map((c) => [c, []]));
  for (const r of rows) byCode.get(r.code as string)?.push([r.ts as string, Number(r.value)]);
  return byCode;
}

const num = (v: unknown) => (v === null ? null : Number(v));

function toSeasonalRows(rows: Record<string, unknown>[]): SeasonalRow[] {
  return rows.map((r) => ({
    day: r.day as string,
    min: num(r.min_value),
    max: num(r.max_value),
    mean: num(r.mean_value),
    yearsCount: Number(r.years_count),
    current: num(r.current_value),
  }));
}

/** Five-year seasonal comparison for a daily series (web.seasonal_daily, migration 002). */
export async function getSeasonal(code: string, year: number): Promise<SeasonalRow[]> {
  "use cache";
  cacheLife("hours");
  const rows = await query(
    "getSeasonal",
    (sql) => sql`
    select to_char(day, 'YYYY-MM-DD') as day, min_value, max_value, mean_value, years_count,
           current_value
    from web.seasonal_daily(${code}, ${year})
  `,
  );
  return toSeasonalRows(rows);
}

/**
 * Five-year seasonal comparison for a weekly series by ISO week (web.seasonal_weekly, migration
 * 005). `day` is the Monday of the week in 2001; `year` is an ISO year.
 */
export async function getSeasonalWeekly(code: string, year: number): Promise<SeasonalRow[]> {
  "use cache";
  cacheLife("hours");
  const rows = await query(
    "getSeasonalWeekly",
    (sql) => sql`
    select to_char(day, 'YYYY-MM-DD') as day, min_value, max_value, mean_value, years_count,
           current_value
    from web.seasonal_weekly(${code}, ${year})
  `,
  );
  return toSeasonalRows(rows);
}
