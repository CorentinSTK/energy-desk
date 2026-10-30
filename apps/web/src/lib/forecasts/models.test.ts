import { describe, expect, it } from "vitest";

import type { ForecastScore } from "@/lib/data/forecasts";

import { FORECAST_MODELS, formatSkill, headlineScore, modelInfo, verdict } from "./models";

const score = (over: Partial<ForecastScore>): ForecastScore => ({
  modelId: "eu_storage_30d",
  version: "1",
  kind: "backtest",
  horizon: 30,
  n: 2827,
  mae: 1.84,
  rmse: 2.41,
  bias: 0.08,
  maeNaive: 8.0,
  maeSeasonal: 2.26,
  skillNaive: 0.77,
  skillSeasonal: 0.19,
  coverage90: 0.888,
  nIntervals: 2700,
  ...over,
});

describe("verdict", () => {
  it("needs enough scored forecasts", () => {
    expect(verdict(undefined)).toEqual({ status: "too-few", n: 0 });
    expect(verdict(score({ n: 12 }))).toEqual({ status: "too-few", n: 12 });
  });

  it("requires a clear edge over both baselines", () => {
    expect(verdict(score({})).status).toBe("beats");
    // US crude stocks backtest: +2% and +1% is not a clear edge.
    expect(verdict(score({ skillNaive: 0.02, skillSeasonal: 0.01 })).status).toBe("no-clear-edge");
    expect(verdict(score({ skillSeasonal: -0.05 })).status).toBe("does-not-beat");
    expect(verdict(score({ skillNaive: null })).status).toBe("does-not-beat");
  });
});

describe("models", () => {
  it("has the worker's model ids, each with its headline horizon among its horizons", () => {
    expect(FORECAST_MODELS.map((m) => m.id)).toEqual([
      "eu_storage_30d",
      "fr_power_demand",
      "us_crude_stocks",
    ]);
    for (const m of FORECAST_MODELS) expect(m.horizons).toContain(m.headlineHorizon);
  });

  it("picks the headline horizon of the latest version", () => {
    const model = modelInfo("fr_power_demand");
    expect(model).toBeDefined();
    const scores = [
      score({ modelId: "fr_power_demand", horizon: 1, version: "1", mae: 9 }),
      score({ modelId: "fr_power_demand", horizon: 1, version: "2", mae: 8 }),
      score({ modelId: "fr_power_demand", horizon: 3, version: "2", mae: 7 }),
      score({ modelId: "fr_power_demand", horizon: 1, version: "2", kind: "live", mae: 6 }),
    ];
    expect(headlineScore(scores, model!, "backtest")?.mae).toBe(8);
    expect(headlineScore(scores, model!, "live")?.mae).toBe(6);
  });
});

describe("formatSkill", () => {
  it("signs the percentage", () => {
    expect(formatSkill(0.7713)).toBe("+77%");
    expect(formatSkill(-0.05)).toBe("−5%");
    expect(formatSkill(0.001)).toBe("0%");
    expect(formatSkill(null)).toBe("—");
  });
});
