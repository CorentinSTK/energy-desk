/**
 * Indicators of the Lab rule grammar. Each value at index t uses only observations 0..t of the
 * series it is computed on (its own frequency: a weekly series is measured in weeks), so a rule can
 * never react to data from after the day it is evaluated.
 */

export type Points = [string, number][];

export const INDICATOR_KINDS = [
  "value",
  "zscore",
  "percentile",
  "change",
  "ma_distance",
  "seasonal",
] as const;
export type IndicatorKind = (typeof INDICATOR_KINDS)[number];

export interface Indicator {
  kind: IndicatorKind;
  /** Look-back in observations (ignored by "value" and "seasonal"). */
  window: number;
}

const SEASONAL_YEARS = 5;
const MIN_SEASONAL_YEARS = 3;

function windowSlice(values: number[], t: number, window: number): number[] | null {
  return t + 1 >= window ? values.slice(t + 1 - window, t + 1) : null;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/** ISO week (53 folded into 52) and ISO year of a date: the week's Thursday decides the year. */
export function isoWeek(iso: string): { year: number; week: number } {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const isoDay = d.getUTCDay() || 7; // Monday = 1 … Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - isoDay);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 864e5 + 1) / 7);
  return { year: d.getUTCFullYear(), week: Math.min(week, 52) };
}

/**
 * Distance of each value from the mean of the same ISO week in the five previous ISO years, in % of
 * that mean (weekly stock series). Null without at least three prior years.
 */
function seasonalDeviation(points: Points): (number | null)[] {
  const byWeek = new Map<string, number>();
  const keys = points.map(([ts]) => isoWeek(ts));
  points.forEach(([, v], i) => byWeek.set(`${keys[i].year}-${keys[i].week}`, v));
  return points.map(([, v], i) => {
    const { year, week } = keys[i];
    const prior: number[] = [];
    for (let back = 1; back <= SEASONAL_YEARS; back++) {
      const p = byWeek.get(`${year - back}-${week}`);
      if (p !== undefined) prior.push(p);
    }
    if (prior.length < MIN_SEASONAL_YEARS) return null;
    const m = mean(prior);
    return m === 0 ? null : ((v - m) / Math.abs(m)) * 100;
  });
}

/** Indicator values aligned with `points` (null while the look-back is not filled). */
export function computeIndicator(points: Points, indicator: Indicator): (number | null)[] {
  const values = points.map(([, v]) => v);
  const { kind, window } = indicator;
  switch (kind) {
    case "value":
      return values;
    case "seasonal":
      return seasonalDeviation(points);
    case "change":
      return values.map((v, t) => (t >= window ? v - values[t - window] : null));
    case "zscore":
      return values.map((v, t) => {
        const w = windowSlice(values, t, window);
        if (!w) return null;
        const s = std(w);
        return s > 0 ? (v - mean(w)) / s : null;
      });
    case "percentile":
      return values.map((v, t) => {
        const w = windowSlice(values, t, window);
        return w ? (w.filter((x) => x <= v).length / w.length) * 100 : null;
      });
    case "ma_distance":
      return values.map((v, t) => {
        const w = windowSlice(values, t, window);
        return w ? v - mean(w) : null;
      });
  }
}

/**
 * Signal values on the traded series' dates: for each date, the latest signal observation that was
 * already published, i.e. dated at least `lagDays` before (weekly EIA stocks: week ending Friday,
 * published the next Wednesday, so lag 5).
 */
export function alignSignal(
  tradedDates: string[],
  signalDates: string[],
  signal: (number | null)[],
  lagDays: number,
): (number | null)[] {
  const lagMs = lagDays * 864e5;
  const available = signalDates.map((d) => Date.parse(d) + lagMs);
  const out: (number | null)[] = [];
  let j = -1;
  for (const d of tradedDates) {
    const t = Date.parse(d);
    while (j + 1 < available.length && available[j + 1] <= t) j++;
    out.push(j >= 0 ? signal[j] : null);
  }
  return out;
}
