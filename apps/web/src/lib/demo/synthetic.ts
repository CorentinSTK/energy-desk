/**
 * SYNTHETIC DEMO DATA — for the style guide only (/styleguide). Not market data.
 *
 * Deterministic formulas (sine waves plus seeded noise), so screenshots and tests are reproducible.
 * Nothing here may be imported by a market page; real data comes only from `lib/data/`.
 */

import type { SeasonalInput, TimeSeriesPoint } from "@/components/charts/options";

/** Small seeded PRNG (mulberry32): same seed, same sequence. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface DailyOptions {
  start: string;
  days: number;
  level: number;
  amplitude: number;
  seed: number;
  /** Indexes to blank out, to demonstrate how gaps are drawn. */
  gaps?: [number, number][];
}

export function syntheticDailySeries(o: DailyOptions): TimeSeriesPoint[] {
  const random = seededRandom(o.seed);
  const start = new Date(o.start).getTime();
  let drift = 0;
  return Array.from({ length: o.days }, (_, i) => {
    drift += (random() - 0.5) * o.amplitude * 0.08;
    const value = o.level + o.amplitude * Math.sin(i / 90) + drift;
    const inGap = o.gaps?.some(([from, to]) => i >= from && i <= to) ?? false;
    const date = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    return [date, inGap ? null : Math.round(value * 100) / 100];
  });
}

const WEEKS = 52;

/** A seasonal profile (e.g. storage that fills in summer) for five past years plus a partial current year. */
export function syntheticSeasonal(seed: number, currentWeeks: number) {
  const random = seededRandom(seed);
  const profile = (week: number, offset: number) =>
    60 + 35 * Math.sin(((week - 13) / WEEKS) * 2 * Math.PI) + offset;

  const years = Array.from({ length: 5 }, () => {
    const offset = (random() - 0.5) * 20;
    return Array.from({ length: WEEKS }, (_, w) => profile(w, offset) + (random() - 0.5) * 4);
  });
  const round = (v: number) => Math.round(v * 10) / 10;

  const periods = Array.from({ length: WEEKS }, (_, w) => `W${w + 1}`);
  const column = (w: number) => years.map((y) => y[w]);
  const min = periods.map((_, w) => round(Math.min(...column(w))));
  const max = periods.map((_, w) => round(Math.max(...column(w))));
  const average = periods.map((_, w) => round(column(w).reduce((a, b) => a + b, 0) / years.length));
  const current = periods.map((_, w) =>
    w < currentWeeks ? round(profile(w, -12) + (random() - 0.5) * 3) : null,
  );

  return { periods, min, max, average, current } satisfies Partial<SeasonalInput>;
}
