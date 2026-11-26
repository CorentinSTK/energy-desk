import { describe, expect, it } from "vitest";

import type { Points } from "@/lib/data/series";
import { combineDaily, seasonalFromDaily } from "@/lib/seasonal";

describe("combineDaily", () => {
  it("keeps only days present in every series", () => {
    const a: Points = [
      ["2026-01-01T00:00:00Z", 10],
      ["2026-01-02T00:00:00Z", 20],
    ];
    const b: Points = [["2026-01-02T00:00:00Z", 5]];
    expect(combineDaily([a, b], ([x, y]) => x - y)).toEqual([["2026-01-02T00:00:00Z", 15]]);
  });
});

describe("seasonalFromDaily", () => {
  const points: Points = [
    ["2024-01-05T00:00:00Z", 10],
    ["2025-01-05T00:00:00Z", 30],
    ["2026-01-05T00:00:00Z", 25],
    ["2020-01-05T00:00:00Z", 999], // outside the 5 prior years of 2026
    ["2024-02-29T00:00:00Z", 1], // leap day: left out
  ];
  const rows = seasonalFromDaily(points, 2026);

  it("has one row per day of 2001", () => {
    expect(rows).toHaveLength(365);
  });

  it("builds the norm from prior years only, and the current year apart", () => {
    const jan5 = rows.find((r) => r.day === "2001-01-05");
    expect(jan5).toEqual({
      day: "2001-01-05",
      min: 10,
      max: 30,
      mean: 20,
      yearsCount: 2,
      current: 25,
    });
  });
});
