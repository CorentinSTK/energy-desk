/**
 * The Lab's safe rule grammar: a typed rule built from allow-listed choices and bounded numbers,
 * read from the URL. Nothing a visitor types is ever evaluated as code.
 */

import { INDICATOR_KINDS, type Indicator, type IndicatorKind } from "./indicators";

export interface Instrument {
  id: string;
  label: string;
  /** Series codes: one series, or a spread `codes[0] − codes[1]` of two series of the same price kind. */
  codes: [string] | [string, string];
  unit: string;
  decimals: number;
  frequency: "daily" | "weekly";
  /** Days between an observation's date and its publication, when used as a signal. */
  lagDays: number;
  /** Can be the traded series (a price or a spread); otherwise signal only. */
  tradable: boolean;
}

/** Official series with long histories (BUILD_SPEC §7, ADR 0010). */
export const INSTRUMENTS: Instrument[] = [
  {
    id: "brent",
    label: "Brent spot",
    codes: ["eia.brent_spot"],
    unit: "$/bbl",
    decimals: 2,
    frequency: "daily",
    lagDays: 0,
    tradable: true,
  },
  {
    id: "wti",
    label: "WTI spot",
    codes: ["eia.wti_spot"],
    unit: "$/bbl",
    decimals: 2,
    frequency: "daily",
    lagDays: 0,
    tradable: true,
  },
  {
    id: "brent_wti",
    label: "Brent − WTI spot spread",
    codes: ["eia.brent_spot", "eia.wti_spot"],
    unit: "$/bbl",
    decimals: 2,
    frequency: "daily",
    lagDays: 0,
    tradable: true,
  },
  {
    id: "crack_321",
    label: "US Gulf Coast 3-2-1 crack",
    codes: ["eia.crack_321_usgc"],
    unit: "$/bbl",
    decimals: 2,
    frequency: "daily",
    lagDays: 0,
    tradable: true,
  },
  {
    id: "crack_diesel",
    label: "NY Harbor diesel crack vs Brent",
    codes: ["eia.crack_ulsd_nyh_brent"],
    unit: "$/bbl",
    decimals: 2,
    frequency: "daily",
    lagDays: 0,
    tradable: true,
  },
  {
    id: "de_fr",
    label: "DE-LU − France day-ahead base spread",
    codes: ["smard.de_lu.price_da_base", "smard.fr.price_da_base"],
    unit: "€/MWh",
    decimals: 2,
    frequency: "daily",
    lagDays: 0,
    tradable: true,
  },
  {
    id: "de_base",
    label: "DE-LU day-ahead base",
    codes: ["smard.de_lu.price_da_base"],
    unit: "€/MWh",
    decimals: 2,
    frequency: "daily",
    lagDays: 0,
    tradable: true,
  },
  {
    id: "henry_hub",
    label: "Henry Hub spot",
    codes: ["eia.henry_hub_spot"],
    unit: "$/MMBtu",
    decimals: 3,
    frequency: "daily",
    lagDays: 0,
    tradable: true,
  },
  {
    id: "us_distillate_stocks",
    label: "US distillate stocks (EIA weekly)",
    codes: ["eia.us_distillate_stocks"],
    unit: "kb",
    decimals: 0,
    frequency: "weekly",
    lagDays: 5,
    tradable: false,
  },
  {
    id: "us_crude_stocks",
    label: "US commercial crude stocks (EIA weekly)",
    codes: ["eia.us_crude_stocks"],
    unit: "kb",
    decimals: 0,
    frequency: "weekly",
    lagDays: 5,
    tradable: false,
  },
  {
    id: "eu_storage",
    label: "EU gas storage, % full (GIE)",
    codes: ["agsi.eu.full"],
    unit: "%",
    decimals: 1,
    frequency: "daily",
    lagDays: 1,
    tradable: false,
  },
];

export function instrument(id: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

export type Side = "long" | "short";
export type Comparator = "gt" | "lt";

export interface Rule {
  traded: string;
  signal: string;
  indicator: Indicator;
  side: Side;
  entry: { op: Comparator; threshold: number };
  /** Exit when the indicator meets this condition; null: exit only by holding period, stop or target. */
  exit: { op: Comparator; threshold: number } | null;
  /** Exit after this many observations in the trade; null: no limit. */
  maxHold: number | null;
  /** Exit when the trade has lost (stop) or gained (target) this much, in the traded unit. */
  stop: number | null;
  target: number | null;
  /** Cost of one round trip, in the traded unit. */
  cost: number;
}

export interface Preset {
  id: string;
  label: string;
  idea: string;
  rule: Rule;
}

export const PRESETS: Preset[] = [
  {
    id: "de_fr_mean_reversion",
    label: "DE–FR day-ahead spread, mean reversion",
    idea: "When German power is unusually expensive against France (z-score above 2 over 60 days), bet on the spread narrowing; exit when it is back near its mean.",
    rule: {
      traded: "de_fr",
      signal: "de_fr",
      indicator: { kind: "zscore", window: 60 },
      side: "short",
      entry: { op: "gt", threshold: 2 },
      exit: { op: "lt", threshold: 0.5 },
      maxHold: 20,
      stop: null,
      target: null,
      cost: 1,
    },
  },
  {
    id: "brent_wti_mean_reversion",
    label: "Brent–WTI spread, mean reversion",
    idea: "When Brent's premium over WTI is unusually wide (z-score above 2 over 120 days), bet on it narrowing; exit at the mean or after 60 days.",
    rule: {
      traded: "brent_wti",
      signal: "brent_wti",
      indicator: { kind: "zscore", window: 120 },
      side: "short",
      entry: { op: "gt", threshold: 2 },
      exit: { op: "lt", threshold: 0 },
      maxHold: 60,
      stop: null,
      target: null,
      cost: 0.1,
    },
  },
  {
    id: "crack_low_percentile",
    label: "3-2-1 crack at a three-year low",
    idea: "When the refining margin is in the bottom 10% of the last three years, bet on recovery; exit when it is back above its median.",
    rule: {
      traded: "crack_321",
      signal: "crack_321",
      indicator: { kind: "percentile", window: 756 },
      side: "long",
      entry: { op: "lt", threshold: 10 },
      exit: { op: "gt", threshold: 50 },
      maxHold: 120,
      stop: null,
      target: null,
      cost: 0.2,
    },
  },
  {
    id: "diesel_crack_low_stocks",
    label: "Diesel crack when US distillate stocks are low",
    idea: "When US distillate stocks are more than 5% below their five-year norm for the week (as published, five days after the week ends), bet on a firmer diesel crack; exit when stocks are back at normal.",
    rule: {
      traded: "crack_diesel",
      signal: "us_distillate_stocks",
      indicator: { kind: "seasonal", window: 1 },
      side: "long",
      entry: { op: "lt", threshold: -5 },
      exit: { op: "gt", threshold: 0 },
      maxHold: 60,
      stop: null,
      target: null,
      cost: 0.3,
    },
  },
  {
    id: "brent_trend",
    label: "Brent trend (above its 100-day average)",
    idea: "A trend rule rather than mean reversion: long Brent while it is above its 100-day moving average, flat otherwise.",
    rule: {
      traded: "brent",
      signal: "brent",
      indicator: { kind: "ma_distance", window: 100 },
      side: "long",
      entry: { op: "gt", threshold: 0 },
      exit: { op: "lt", threshold: 0 },
      maxHold: null,
      stop: null,
      target: null,
      cost: 0.1,
    },
  },
];

export const LIMITS = {
  window: [5, 756],
  maxHold: [1, 750],
  threshold: [-1e6, 1e6],
  cost: [0, 1e4],
  stop: [0, 1e6],
} as const;

type Params = Record<string, string | string[] | undefined>;

function number(
  params: Params,
  key: string,
  [low, high]: readonly [number, number],
): number | undefined {
  const raw = params[key];
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= low && value <= high ? value : undefined;
}

function choice<T extends string>(
  params: Params,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const raw = params[key];
  return allowed.find((a) => a === raw);
}

/**
 * Rule from the URL: start from the preset (or the first one), then apply each parameter that is
 * present and valid. Anything unknown, out of range or malformed is ignored, never interpreted.
 */
export function parseRule(params: Params): { preset: Preset | undefined; rule: Rule } {
  const preset = PRESETS.find((p) => p.id === params.preset);
  const base = (preset ?? PRESETS[0]).rule;
  const tradable = INSTRUMENTS.filter((i) => i.tradable).map((i) => i.id);
  const traded = choice(params, "traded", tradable) ?? base.traded;
  const signal =
    choice(
      params,
      "signal",
      INSTRUMENTS.map((i) => i.id),
    ) ?? base.signal;
  const kind = choice<IndicatorKind>(params, "ind", INDICATOR_KINDS) ?? base.indicator.kind;
  const window = number(params, "win", LIMITS.window);
  const entryOp = choice<Comparator>(params, "eop", ["gt", "lt"]) ?? base.entry.op;
  const entryThreshold = number(params, "eth", LIMITS.threshold) ?? base.entry.threshold;
  const exitOp = choice<Comparator>(params, "xop", ["gt", "lt"]);
  const exitThreshold = number(params, "xth", LIMITS.threshold);
  const noExit = params.xop === "none";
  const hold = params.hold === "none" ? null : number(params, "hold", LIMITS.maxHold);
  const stop = params.stop === "none" ? null : number(params, "stop", LIMITS.stop);
  const target = params.target === "none" ? null : number(params, "target", LIMITS.stop);
  return {
    preset: preset ?? (Object.keys(params).length === 0 ? PRESETS[0] : undefined),
    rule: {
      traded,
      signal,
      indicator: { kind, window: Math.round(window ?? base.indicator.window) },
      side: choice<Side>(params, "side", ["long", "short"]) ?? base.side,
      entry: { op: entryOp, threshold: entryThreshold },
      exit: noExit
        ? null
        : exitOp !== undefined || exitThreshold !== undefined
          ? {
              op: exitOp ?? base.exit?.op ?? "lt",
              threshold: exitThreshold ?? base.exit?.threshold ?? 0,
            }
          : base.exit,
      maxHold: hold === undefined ? base.maxHold : hold === null ? null : Math.round(hold),
      stop: stop === undefined ? base.stop : stop || null,
      target: target === undefined ? base.target : target || null,
      cost: number(params, "cost", LIMITS.cost) ?? base.cost,
    },
  };
}

/** URL parameters for a rule (the form writes these; parseRule reads them back). */
export function ruleQuery(rule: Rule): Record<string, string> {
  return {
    traded: rule.traded,
    signal: rule.signal,
    ind: rule.indicator.kind,
    win: String(rule.indicator.window),
    side: rule.side,
    eop: rule.entry.op,
    eth: String(rule.entry.threshold),
    xop: rule.exit ? rule.exit.op : "none",
    xth: rule.exit ? String(rule.exit.threshold) : "",
    hold: rule.maxHold === null ? "none" : String(rule.maxHold),
    stop: rule.stop === null ? "none" : String(rule.stop),
    target: rule.target === null ? "none" : String(rule.target),
    cost: String(rule.cost),
  };
}
