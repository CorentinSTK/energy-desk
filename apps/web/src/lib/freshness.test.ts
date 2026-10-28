import { describe, expect, it } from "vitest";

import { freshnessStatus } from "./freshness";

const now = new Date("2026-10-28T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("freshnessStatus", () => {
  it("treats daily data over a weekend as fresh", () => {
    expect(freshnessStatus(daysAgo(3), "daily", now)).toBe("fresh");
  });

  it("flags daily data a week old as delayed, then stale", () => {
    expect(freshnessStatus(daysAgo(6), "daily", now)).toBe("delayed");
    expect(freshnessStatus(daysAgo(8), "daily", now)).toBe("stale");
  });

  it("applies weekly and monthly thresholds", () => {
    expect(freshnessStatus(daysAgo(9), "weekly", now)).toBe("fresh");
    expect(freshnessStatus(daysAgo(20), "weekly", now)).toBe("stale");
    expect(freshnessStatus(daysAgo(40), "monthly", now)).toBe("fresh");
    expect(freshnessStatus(daysAgo(60), "monthly", now)).toBe("delayed");
  });

  it("treats hourly day-ahead data from yesterday as fresh", () => {
    expect(freshnessStatus(daysAgo(1), "hourly", now)).toBe("fresh");
  });
});
