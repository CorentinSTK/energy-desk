import { describe, expect, it } from "vitest";

import type { Points } from "@/lib/data/series";
import { couplingCell, couplingMatrix, gapBin } from "@/lib/power/coupling";

const a: Points = [
  ["2026-11-20T00:00:00Z", 100],
  ["2026-11-20T01:00:00Z", 90],
  ["2026-11-20T02:00:00Z", 80],
  ["2026-11-20T03:00:00Z", 70],
];
const b: Points = [
  ["2026-11-20T00:00:00Z", 100],
  ["2026-11-20T01:00:00Z", 95],
  // 02:00 missing: not counted, never filled
  ["2026-11-20T03:00:00Z", 70.001],
];

describe("couplingCell", () => {
  it("counts common hours, same-price hours and the mean absolute spread", () => {
    const cell = couplingCell(a, b);
    expect(cell.hours).toBe(3);
    expect(cell.sameShare).toBeCloseTo(2 / 3);
    expect(cell.meanAbsSpread).toBeCloseTo((0 + 5 + 0.001) / 3);
  });

  it("returns nulls without common hours", () => {
    expect(couplingCell(a, [])).toEqual({ hours: 0, sameShare: null, meanAbsSpread: null });
  });
});

describe("couplingMatrix", () => {
  it("is symmetric with an empty diagonal", () => {
    const m = couplingMatrix([a, b]);
    expect(m[0][0]).toBeNull();
    expect(m[0][1]).toEqual(m[1][0]);
  });
});

describe("gapBin", () => {
  it("gives the darkest bin to the closest prices", () => {
    expect(gapBin(0)).toBe(5);
    expect(gapBin(4.99)).toBe(5);
    expect(gapBin(5)).toBe(4);
    expect(gapBin(29)).toBe(3);
    expect(gapBin(60)).toBe(1);
    expect(gapBin(250)).toBe(1);
  });
});
