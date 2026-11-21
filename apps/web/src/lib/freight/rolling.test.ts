import { describe, expect, it } from "vitest";

import type { Points, SeasonalRow } from "@/lib/data/series";

import { everyNthDay, rollingMean, weekVsSeason } from "./rolling";

const day = (d: number) => `2026-11-${String(d).padStart(2, "0")}T00:00:00Z`;
const daily = (values: number[], first = 1): Points => values.map((v, i) => [day(first + i), v]);
const season = (mean: number | null): SeasonalRow[] =>
  Array.from({ length: 30 }, (_, i) => ({
    day: `2001-11-${String(i + 1).padStart(2, "0")}`,
    min: null,
    max: null,
    mean,
    yearsCount: 5,
    current: null,
  }));

describe("rollingMean", () => {
  it("averages complete 7-day windows, dated on their last day", () => {
    const means = rollingMean(daily([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(means).toEqual([
      [day(7), 4],
      [day(8), 5],
    ]);
  });

  it("leaves out windows with a missing day instead of averaging fewer days", () => {
    const points = daily([1, 1, 1, 1, 1, 1, 1, 1, 1]).filter(([ts]) => ts !== day(5));
    expect(rollingMean(points)).toEqual([]);
  });
});

describe("weekVsSeason", () => {
  it("compares the last 7-day mean with the same calendar days of the norm", () => {
    const result = weekVsSeason(daily([3, 3, 3, 3, 3, 3, 3, 3], 5), season(60));
    expect(result).toMatchObject({ value: 3, normal: 60, asOf: day(12) });
    expect(result?.deviationPct).toBeCloseTo(-95);
  });

  it("is null when the norm lacks a day or the series lacks a full week", () => {
    expect(weekVsSeason(daily([3, 3, 3, 3, 3, 3, 3]), season(null))).toBeNull();
    expect(weekVsSeason(daily([3, 3, 3]), season(60))).toBeNull();
  });
});

describe("everyNthDay", () => {
  it("keeps one point per step, counted back from the last day", () => {
    const points = daily([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(everyNthDay(points, 7).map(([ts]) => ts)).toEqual([day(1), day(8), day(15)]);
  });

  it("anchors on calendar days, so a missing day does not shift the weeks", () => {
    const points = daily([1, 2, 3, 4, 5, 6, 7, 8, 9]).filter(([ts]) => ts !== day(2));
    expect(everyNthDay(points, 7).map(([ts]) => ts)).toEqual([day(9)]);
  });
});
