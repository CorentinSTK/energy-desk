import { describe, expect, it } from "vitest";

import { displayUnit, rescale } from "./display-units";

describe("display units", () => {
  it("rescales kWh/d to GWh/d and leaves other units alone", () => {
    expect(displayUnit("kWh/d")).toEqual({ unit: "GWh/d", factor: 1e-6 });
    expect(rescale([["2026-10-26T00:00:00Z", 519537222]], "kWh/d")[0][1]).toBeCloseTo(519.537222);
    expect(rescale([["2026-10-26T00:00:00Z", 74.9]], "%")[0][1]).toBe(74.9);
  });

  it("shows oil stocks in million barrels and pump prices per litre", () => {
    expect(displayUnit("kb")).toEqual({ unit: "mb", factor: 1e-3 });
    expect(rescale([["2026-10-23T00:00:00Z", 410625]], "kb")[0][1]).toBeCloseTo(410.625);
    expect(displayUnit("€/1000 L").unit).toBe("€/L");
    expect(rescale([["2026-10-26T00:00:00Z", 2298]], "€/1000 L")[0][1]).toBeCloseTo(2.298);
    expect(displayUnit("kb/d")).toEqual({ unit: "kb/d", factor: 1 });
  });
});
