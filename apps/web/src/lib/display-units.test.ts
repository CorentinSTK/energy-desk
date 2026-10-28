import { describe, expect, it } from "vitest";

import { displayUnit, rescale } from "./display-units";

describe("display units", () => {
  it("rescales kWh/d to GWh/d and leaves other units alone", () => {
    expect(displayUnit("kWh/d")).toEqual({ unit: "GWh/d", factor: 1e-6 });
    expect(rescale([["2026-10-26T00:00:00Z", 519537222]], "kWh/d")[0][1]).toBeCloseTo(519.537222);
    expect(rescale([["2026-10-26T00:00:00Z", 74.9]], "%")[0][1]).toBe(74.9);
  });
});
