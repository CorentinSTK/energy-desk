import { describe, expect, it } from "vitest";

import type { Points } from "@/lib/data/series";
import { hourlyProfile, negativeHoursByMonth } from "@/lib/power/hourly";

const TZ = "Europe/Berlin";

describe("negativeHoursByMonth", () => {
  it("counts negative hours per local month", () => {
    const p: Points = [
      ["2026-05-31T22:00:00Z", -5], // 1 June 00:00 in Berlin (CEST)
      ["2026-05-31T21:00:00Z", -1], // 31 May 23:00 in Berlin
      ["2026-06-01T10:00:00Z", 40],
    ];
    expect(negativeHoursByMonth(p, TZ)).toEqual([
      { month: "2026-05", negative: 1, hours: 1 },
      { month: "2026-06", negative: 1, hours: 2 },
    ]);
  });
});

describe("hourlyProfile", () => {
  it("averages by local hour and leaves empty hours null", () => {
    const p: Points = [
      ["2026-01-10T11:00:00Z", 10], // 12:00 in Berlin (CET)
      ["2026-01-11T11:00:00Z", 30],
    ];
    const profile = hourlyProfile(p, TZ);
    expect(profile[12]).toBe(20);
    expect(profile[0]).toBeNull();
  });
});
