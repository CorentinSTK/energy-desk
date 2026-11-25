import { describe, expect, it } from "vitest";

import type { Points } from "@/lib/data/series";
import { BORDERS, direction, trailingMean } from "@/lib/power/flows";

const day = (d: number) => `2026-11-${String(d).padStart(2, "0")}T00:00:00Z`;

describe("trailingMean", () => {
  it("averages the last consecutive days", () => {
    const p: Points = [
      [day(20), 10],
      [day(21), 20],
      [day(22), 30],
    ];
    expect(trailingMean(p, 2)).toEqual({ mean: 25, asOf: day(22) });
  });
  it("refuses a window with a missing day", () => {
    const p: Points = [
      [day(20), 10],
      [day(22), 30],
    ];
    expect(trailingMean(p, 2)).toBeNull();
  });
});

describe("direction", () => {
  it("names the exporter from the sign", () => {
    const fr = BORDERS[0];
    expect(direction(fr, 1500)).toEqual({ exporter: "FR", importer: "DE-LU" });
    expect(direction(fr, -200)).toEqual({ exporter: "DE-LU", importer: "FR" });
  });
});
