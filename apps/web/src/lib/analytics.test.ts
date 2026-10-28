import { describe, expect, it } from "vitest";

import type { Points } from "@/lib/data/series";

import {
  changeFromPrevious,
  changeOverDays,
  compareWithSeason,
  latest,
  percentileRank,
  sharePercent,
  valueDaysBefore,
} from "./analytics";

const points: Points = [
  ["2026-10-19T00:00:00Z", 70],
  ["2026-10-20T00:00:00Z", 71],
  ["2026-10-26T00:00:00Z", 75],
];

describe("latest and changes", () => {
  it("reads the last point", () => {
    expect(latest(points)).toEqual({ ts: "2026-10-26T00:00:00Z", value: 75 });
    expect(latest([])).toBeNull();
  });

  it("compares with the exact date only", () => {
    expect(valueDaysBefore(points, 7)).toBe(70);
    expect(changeOverDays(points, 7)).toBe(5);
    // 2026-10-25 is missing: no comparison rather than a different period.
    expect(changeOverDays(points, 1)).toBeNull();
  });
});

describe("percentileRank", () => {
  it("counts values at or below", () => {
    expect(percentileRank(3, [1, 2, 3, 4])).toBe(75);
    expect(percentileRank(0, [1, 2])).toBe(0);
    expect(percentileRank(5, [])).toBeNull();
  });
});

describe("compareWithSeason", () => {
  it("places the current value against the five-year range", () => {
    expect(
      compareWithSeason({ current: 74.9, mean: 89.6, min: 77, max: 98.6, yearsCount: 5 }),
    ).toMatchObject({
      position: "below",
      deviation: expect.closeTo(-14.7, 5),
    });
    expect(
      compareWithSeason({ current: 90, mean: 89, min: 77, max: 98, yearsCount: 5 })?.position,
    ).toBe("within");
  });

  it("returns null when a value is missing", () => {
    expect(compareWithSeason({ current: null, mean: 1, min: 0, max: 2, yearsCount: 5 })).toBeNull();
  });
});

describe("changeFromPrevious", () => {
  it("uses the previous observation, whatever its date", () => {
    expect(changeFromPrevious(points)).toBe(4);
    expect(changeFromPrevious(points.slice(0, 1))).toBeNull();
  });
});

describe("sharePercent", () => {
  it("divides values of the same date and unit", () => {
    expect(sharePercent(33702.63, 62749.73)).toBeCloseTo(53.71, 2);
    expect(sharePercent(null, 100)).toBeNull();
    expect(sharePercent(1, 0)).toBeNull();
  });
});
