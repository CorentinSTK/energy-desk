import { describe, expect, it } from "vitest";

import {
  largestFlowTakeaway,
  monthlyBenchmarkTakeaway,
  promptSpreadTakeaway,
  seasonalLevelTakeaway,
  storageTakeaway,
  balanceTakeaway,
  curveTakeaway,
  positioningTakeaway,
  pumpPriceTakeaway,
  spreadTakeaway,
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

describe("seasonalLevelTakeaway", () => {
  const c = {
    current: 4099.7,
    mean: 3200,
    min: 2500,
    max: 3900,
    yearsCount: 5,
    deviation: 899.7,
    position: "above" as const,
  };
  it("states the relative distance and the range position", () => {
    expect(
      seasonalLevelTakeaway("EU LNG send-out", "2026-10-26T00:00:00Z", c, "GWh/d", 0, "2021–2025"),
    ).toBe(
      "EU LNG send-out was 4,100 GWh/d on 26 Oct 2026, 28% above the 2021–2025 average for this date, above the 2021–2025 range.",
    );
  });
  it("says close to average within the threshold", () => {
    expect(
      seasonalLevelTakeaway(
        "X",
        "2026-10-26T00:00:00Z",
        { ...c, current: 3300, deviation: 100, position: "within" },
        "GWh/d",
        0,
        "2021–2025",
      ),
    ).toBe("X was 3,300 GWh/d on 26 Oct 2026, close to the 2021–2025 average for this date.");
  });
});

describe("oil takeaways", () => {
  const date = "2026-10-29T00:00:00Z";

  it("describes the curve shape from M1 − M2 and the year-out spread", () => {
    expect(curveTakeaway("WTI", date, 1.95, "$/bbl", 20.56)).toBe(
      "On 29 Oct 2026 WTI is in backwardation: the front month is 1.95 $/bbl above the second month and 20.56 $/bbl above the twelfth.",
    );
    expect(curveTakeaway("RBOB", date, -0.12, "$/gal")).toContain("contango");
    expect(curveTakeaway("RBOB", date, 0.01, "$/gal")).toContain("flat");
  });

  it("says which price is higher", () => {
    expect(spreadTakeaway("Brent", "WTI", 19.73, "$/bbl", 2, date)).toBe(
      "Brent was 19.73 $/bbl above WTI on 29 Oct 2026.",
    );
  });

  it("states managed-money positioning with its share and percentile", () => {
    expect(positioningTakeaway("WTI", date, 36187, 1.97, 35, 3)).toBe(
      "On 29 Oct 2026 managed money was net long 36,187 WTI contracts (2.0% of open interest), the 35th percentile of the last 3 years.",
    );
    expect(positioningTakeaway("RBOB", date, -5000, null, null, 3)).toContain("net short 5,000");
  });

  it("summarises EU pump prices", () => {
    const text = pumpPriceTakeaway(
      "diesel",
      { withTax: 2.146, taxShare: 37, date },
      { area: "Netherlands", withTax: 2.469 },
      { area: "Malta", withTax: 1.21 },
    );
    expect(text).toContain("2.146 €/L on 29 Oct 2026, 37% of it duties and taxes");
    expect(text).toContain("Dearest: Netherlands (2.469 €/L)");
  });
});

describe("balanceTakeaway", () => {
  it("states the surplus or deficit of the latest month", () => {
    expect(balanceTakeaway("2026-09-01T00:00:00Z", 101.3, 104.24)).toBe(
      "In September 2026 world consumption exceeded production by 2.9 mb/d (EIA estimates): stocks were being drawn.",
    );
    expect(balanceTakeaway("2026-09-01T00:00:00Z", 100.05, 100)).toContain("roughly balanced");
  });
});

describe("seasonalLevelTakeaway for weekly stocks", () => {
  it("agrees with a plural subject and writes percentages without a space", () => {
    const c = {
      current: 27,
      mean: 24.8,
      min: 20,
      max: 35,
      deviation: 2.2,
      position: "within" as const,
      yearsCount: 5,
    };
    expect(
      seasonalLevelTakeaway(
        "Cushing crude stocks",
        "2026-10-23T00:00:00Z",
        c,
        "mb",
        1,
        "2021–2025",
        "week",
        true,
      ),
    ).toBe(
      "Cushing crude stocks were 27.0 mb on 23 Oct 2026, 9% above the 2021–2025 average for this week.",
    );
    expect(
      seasonalLevelTakeaway(
        "US refinery utilisation",
        "2026-10-23T00:00:00Z",
        { ...c, current: 92.8 },
        "%",
        1,
        "2021–2025",
        "week",
      ),
    ).toContain("was 92.8% on");
  });
});
