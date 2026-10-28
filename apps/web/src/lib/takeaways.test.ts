import { describe, expect, it } from "vitest";

import {
  largestFlowTakeaway,
  monthlyBenchmarkTakeaway,
  promptSpreadTakeaway,
  storageTakeaway,
} from "./takeaways";

const base = { mean: 89.6, min: 77, max: 98.6, yearsCount: 5 };

describe("storageTakeaway", () => {
  it("states distance from the mean and the range when outside it", () => {
    expect(
      storageTakeaway(
        "EU",
        "2026-10-26T00:00:00Z",
        { ...base, current: 74.9, deviation: -14.7, position: "below" },
        "2021–2025",
      ),
    ).toBe(
      "EU gas storage is 74.9% full on 26 Oct 2026, 14.7 pts below the 2021–2025 average, below the 2021–2025 range (77.0–98.6%).",
    );
  });

  it("says close to average within the threshold and omits the range when inside it", () => {
    expect(
      storageTakeaway(
        "EU",
        "2026-10-26T00:00:00Z",
        { ...base, current: 90.5, deviation: 0.9, position: "within" },
        "2021–2025",
      ),
    ).toBe("EU gas storage is 90.5% full on 26 Oct 2026, close to the 2021–2025 average (89.6%).");
  });

  it("flags a thin norm", () => {
    expect(
      storageTakeaway(
        "DE",
        "2026-10-26T00:00:00Z",
        { ...base, current: 90, deviation: 0.4, position: "within", yearsCount: 3 },
        "2021–2025",
      ),
    ).toContain("Only 3 prior years have data for this date.");
  });
});

describe("promptSpreadTakeaway", () => {
  it("names the curve shape from the sign", () => {
    expect(promptSpreadTakeaway(0.24, "2026-10-28T00:00:00Z")).toContain(
      "+0.24 €/MWh on 28 Oct 2026: backwardation",
    );
    expect(promptSpreadTakeaway(-1.5, "2026-10-28T00:00:00Z")).toContain(
      "−1.50 €/MWh on 28 Oct 2026: contango",
    );
    expect(promptSpreadTakeaway(0.05, "2026-10-28T00:00:00Z")).toContain("flat");
  });
});

describe("monthlyBenchmarkTakeaway", () => {
  it("compares with a year earlier when available", () => {
    expect(monthlyBenchmarkTakeaway(25.494, "2026-09-01T00:00:00Z", 20)).toBe(
      "The IMF European gas benchmark averaged 25.49 $/MMBtu in September 2026, 27% higher than a year earlier.",
    );
    expect(monthlyBenchmarkTakeaway(25.494, "2026-09-01T00:00:00Z", null)).toBe(
      "The IMF European gas benchmark averaged 25.49 $/MMBtu in September 2026.",
    );
  });
});

describe("largestFlowTakeaway", () => {
  it("names the largest point and its share, and counts missing points", () => {
    expect(
      largestFlowTakeaway(
        "2026-10-27T00:00:00Z",
        [
          { name: "Mazara del Vallo", value: 689 },
          { name: "Gela", value: 27 },
          { name: "Bacton (BBL)", value: null },
        ],
        "GWh/d",
      ),
    ).toBe(
      "On 27 Oct 2026 the largest of these entry points was Mazara del Vallo, 689 GWh/d (96% of the points shown). 1 point had no value that day.",
    );
    expect(
      largestFlowTakeaway("2026-10-27T00:00:00Z", [{ name: "A", value: null }], "GWh/d"),
    ).toBeNull();
  });
});
