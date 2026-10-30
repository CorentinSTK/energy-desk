/**
 * The forecast models as the site presents them: plain-language method, baselines, limits and how to
 * read the numbers. The models themselves run in the worker (worker/forecast/models); ids must match.
 */

import type { Commodity } from "@/lib/commodities";
import type { ForecastScore } from "@/lib/data/forecasts";
import { formatNumber } from "@/lib/format";

export interface ForecastModelInfo {
  id: string;
  name: string;
  /** What is forecast, in a few words. */
  target: string;
  targetCode: string;
  commodity: Commodity;
  /** Horizons the model issues, and the one shown first. */
  horizons: number[];
  headlineHorizon: number;
  horizonUnit: "day" | "week";
  /** How often a forecast is issued. */
  cadence: string;
  decimals: number;
  method: string[];
  baselines: { naive: string; seasonal: string };
  limits: string[];
  /** Market page with the target series. */
  href: string;
}

export const FORECAST_MODELS: ForecastModelInfo[] = [
  {
    id: "eu_storage_30d",
    name: "EU gas storage in 30 days",
    target: "EU storage filling level, 30 days after the latest published gas day",
    targetCode: "agsi.eu.full",
    commodity: "natgas",
    horizons: [30],
    headlineHorizon: 30,
    horizonUnit: "day",
    cadence: "Daily, in the evening after GIE AGSI+ publishes the previous gas day",
    decimals: 1,
    method: [
      "Start from the latest filling level and add the change seen over the same 30 calendar days in the five previous years: the seasonal trajectory.",
      "Then correct for how fast storage has been filling or emptying over the last 14 days compared with the same 14 days in those years. The weight of that correction is learned from past dates by least squares, using only outcomes already known.",
    ],
    baselines: {
      naive: "No change: the latest level stays where it is.",
      seasonal: "The latest level plus the average seasonal change, without the pace correction.",
    },
    limits: [
      "Policy decisions (storage targets, releases) and weather shocks are not modelled.",
      "GIE publishes estimates first and confirms them later; backtests use the latest values.",
    ],
    href: "/markets/gas?tab=storage",
  },
  {
    id: "fr_power_demand",
    name: "France daily power demand",
    target: "French daily consumption (average power) 1 to 7 days ahead",
    targetCode: "odre.fr.load",
    commodity: "power",
    horizons: [1, 2, 3, 4, 5, 6, 7],
    headlineHorizon: 1,
    horizonUnit: "day",
    cadence: "Daily, after RTE éCO2mix publishes the previous day",
    decimals: 1,
    method: [
      "French demand rises steeply in the cold because many homes heat with electricity. The model is a linear regression of daily consumption on heating and cooling degree-days of a population-weighted temperature (eight cities), the day of the week, public holidays and the month, fitted on the three years before the issue date.",
      "It then adds its own average error over the last seven known days, which absorbs slow shifts the weather does not explain (energy savings, economic activity).",
    ],
    baselines: {
      naive: "The latest known consumption on the same weekday (one or two weeks earlier).",
      seasonal: "The average of the same calendar day over the five previous years.",
    },
    limits: [
      "Backtests use the observed temperature of each target day, a perfect weather forecast; live forecasts use the Open-Meteo weather forecast, so live errors will be larger than backtest errors.",
      "Strikes, exceptional events and unusual holiday bridges are not modelled.",
      "Recent days are real-time data, later replaced by consolidated values; scores follow the revision.",
    ],
    href: "/markets/power?zone=fr&tab=balance",
  },
  {
    id: "us_crude_stocks",
    name: "US crude stocks, next EIA report",
    target: "US commercial crude stocks in the next weekly EIA report",
    targetCode: "eia.us_crude_stocks",
    commodity: "crude",
    horizons: [1],
    headlineHorizon: 1,
    horizonUnit: "week",
    cadence: "Weekly, on Tuesday, for the report EIA publishes on Wednesday",
    decimals: 1,
    method: [
      "Start from the average change of US crude stocks for that week of the year over the five previous years.",
      "Correct it with a regression, fitted on all earlier weeks, on what was already published: the previous week's surprise against its seasonal norm, refinery utilisation against its norm, and crude net imports against their four-week average.",
    ],
    baselines: {
      naive: "No change: stocks stay at the last published level.",
      seasonal: "The last level plus the average seasonal change for that week.",
    },
    limits: [
      "Weekly stock changes are dominated by cargo timing and are hard to forecast from public data; little skill is expected, and the scores show it.",
      "Industry estimates published the day before EIA (API) are licensed and not used.",
    ],
    href: "/markets/crude?tab=balance",
  },
];

export function modelInfo(id: string): ForecastModelInfo | undefined {
  return FORECAST_MODELS.find((m) => m.id === id);
}

/** Scored forecasts needed before the site says whether a model beats its baselines. */
export const MIN_SCORED_FORECASTS = 30;
/**
 * Skill needed against each baseline to call it beaten: a model only 1–2% better than a baseline
 * could be noise, so the site does not claim an edge below 5%.
 */
export const MIN_CLEAR_SKILL = 0.05;

export type Verdict =
  | { status: "beats"; n: number }
  | { status: "no-clear-edge"; n: number }
  | { status: "does-not-beat"; n: number }
  | { status: "too-few"; n: number };

/**
 * Rule: with at least MIN_SCORED_FORECASTS scored forecasts, a model "beats" its baselines when its
 * skill is at least MIN_CLEAR_SKILL against both the naive and the seasonal baseline; it has "no clear
 * edge" when it is better than both but by less than that; otherwise it "does not beat" them.
 */
export function verdict(score: ForecastScore | undefined): Verdict {
  if (!score || score.n < MIN_SCORED_FORECASTS) return { status: "too-few", n: score?.n ?? 0 };
  const skills = [score.skillNaive, score.skillSeasonal];
  if (skills.some((k) => k === null || k <= 0)) return { status: "does-not-beat", n: score.n };
  if (skills.every((k) => k !== null && k >= MIN_CLEAR_SKILL))
    return { status: "beats", n: score.n };
  return { status: "no-clear-edge", n: score.n };
}

/** The score of the headline horizon for one kind (latest model version first). */
export function headlineScore(
  scores: ForecastScore[],
  model: ForecastModelInfo,
  kind: ForecastScore["kind"],
): ForecastScore | undefined {
  return scores
    .filter((s) => s.kind === kind && s.horizon === model.headlineHorizon)
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
}

/** Skill as a signed percentage: "+77%" means 77% lower mean absolute error than the baseline. */
export function formatSkill(skill: number | null): string {
  if (skill === null) return "—";
  const pct = skill * 100;
  const sign = Math.round(pct) > 0 ? "+" : Math.round(pct) < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(pct), 0)}%`;
}
