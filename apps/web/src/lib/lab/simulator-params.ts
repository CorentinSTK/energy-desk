/**
 * Simulator settings from the URL: allow-listed choices and bounded numbers, with defaults derived
 * from the series (entry at the last level, stop and target two 20-day standard deviations away).
 */

import type { Points } from "./indicators";
import { INSTRUMENTS } from "./rules";
import { REGIMES, type Regime } from "./simulate";

export const PATHS = 2000;
export const BLOCK_SIZE = 20;
export const HORIZON_LIMITS = [5, 250] as const;
const DEFAULT_HORIZON = 60;
const DEFAULT_SEED = 1;
const DEFAULT_WIDTH_DAYS = 20;

export interface SimulatorSettings {
  series: string;
  regime: Regime;
  side: "long" | "short";
  entry: number;
  stop: number;
  target: number;
  horizon: number;
  seed: number;
}

type Params = Record<string, string | string[] | undefined>;

export function seriesFromParams(params: Params): string {
  const tradable = INSTRUMENTS.filter((i) => i.tradable).map((i) => i.id);
  return tradable.find((id) => id === params.series) ?? "brent";
}

/** Standard deviation of daily changes over the last year of observations. */
export function dailyVolatility(points: Points): number {
  const recent = points.slice(-253);
  const changes = recent.slice(1).map(([, v], i) => v - recent[i][1]);
  if (changes.length < 2) return 0;
  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  return Math.sqrt(changes.reduce((a, c) => a + (c - mean) ** 2, 0) / (changes.length - 1));
}

function finite(params: Params, key: string): number | undefined {
  const raw = params[key];
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const v = Number(raw);
  return Number.isFinite(v) && Math.abs(v) < 1e7 ? v : undefined;
}

export function parseSimulator(params: Params, points: Points): SimulatorSettings {
  const last = points.at(-1)?.[1] ?? 0;
  const side = params.side === "short" ? "short" : "long";
  const width = 2 * dailyVolatility(points) * Math.sqrt(DEFAULT_WIDTH_DAYS);
  const sign = side === "long" ? 1 : -1;
  const horizon = finite(params, "horizon");
  const seed = finite(params, "seed");
  return {
    series: seriesFromParams(params),
    regime: REGIMES.find((r) => r.id === params.regime)?.id ?? "full",
    side,
    entry: finite(params, "entry") ?? last,
    stop: finite(params, "stop") ?? last - sign * width,
    target: finite(params, "target") ?? last + sign * width,
    horizon:
      horizon !== undefined
        ? Math.round(Math.min(HORIZON_LIMITS[1], Math.max(HORIZON_LIMITS[0], horizon)))
        : DEFAULT_HORIZON,
    seed: seed !== undefined && seed >= 1 && seed <= 1e9 ? Math.round(seed) : DEFAULT_SEED,
  };
}

/** Why the settings cannot be simulated, or null: the stop must be on the losing side of the entry. */
export function settingsProblem(s: SimulatorSettings): string | null {
  const sign = s.side === "long" ? 1 : -1;
  if (sign * (s.stop - s.entry) >= 0) {
    return `For a ${s.side} position the stop must be ${s.side === "long" ? "below" : "above"} the entry.`;
  }
  if (sign * (s.target - s.entry) <= 0) {
    return `For a ${s.side} position the target must be ${s.side === "long" ? "above" : "below"} the entry.`;
  }
  return null;
}
