/**
 * Seasonal norms for series computed on the site (e.g. net storage withdrawal, a weather index).
 * Same rules as the SQL function web.seasonal_daily (migration 002), so both kinds of series read
 * the same way: each calendar day is mapped to the year 2001, 29 February is left out, and the norm
 * (min, max, mean) uses the `years` years before `year` only; `current` is the value in `year`.
 */

import type { Points, SeasonalRow } from "@/lib/data/series";

/** Values of several daily series combined day by day; only days present in every series. */
export function combineDaily(series: Points[], combine: (values: number[]) => number): Points {
  if (series.length === 0) return [];
  const maps = series.map((s) => new Map(s.map(([ts, v]) => [ts.slice(0, 10), v])));
  const days = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort();
  return days.map((d) => [`${d}T00:00:00Z`, combine(maps.map((m) => m.get(d) as number))]);
}

export function seasonalFromDaily(points: Points, year: number, years = 5): SeasonalRow[] {
  const prior = new Map<string, number[]>();
  const current = new Map<string, number>();
  for (const [ts, value] of points) {
    const y = Number(ts.slice(0, 4));
    const md = ts.slice(5, 10);
    if (md === "02-29" || y < year - years || y > year) continue;
    if (y === year) current.set(md, Math.max(current.get(md) ?? -Infinity, value));
    else prior.set(md, [...(prior.get(md) ?? []), value]);
  }
  const rows: SeasonalRow[] = [];
  for (let t = Date.UTC(2001, 0, 1); t < Date.UTC(2002, 0, 1); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const md = day.slice(5, 10);
    const values = prior.get(md) ?? [];
    rows.push({
      day,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
      yearsCount: values.length,
      current: current.get(md) ?? null,
    });
  }
  return rows;
}
