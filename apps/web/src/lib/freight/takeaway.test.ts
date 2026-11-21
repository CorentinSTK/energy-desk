import { describe, expect, it } from "vitest";

import { chokepointTakeaway, type ChokepointWeek } from "./takeaway";

const week = (label: string, value: number, deviationPct: number | null): ChokepointWeek => ({
  label,
  value,
  normal: 10,
  deviationPct,
  asOf: "2026-11-15T00:00:00Z",
});

describe("chokepointTakeaway", () => {
  it("names the chokepoints furthest below and above their norm", () => {
    const text = chokepointTakeaway(
      [
        week("Strait of Hormuz", 0.4, -99),
        week("Suez Canal", 14, 2),
        week("Cape of Good Hope", 25.1, 131),
      ],
      "2021–2025",
    );
    expect(text).toBe(
      "In the 7 days to 15 Nov 2026, tanker transits averaged: Strait of Hormuz 0.4 a day, 99% below its 2021–2025 norm; Cape of Good Hope 25.1 a day, 131% above its 2021–2025 norm.",
    );
  });

  it("says when every chokepoint is near its norm", () => {
    expect(
      chokepointTakeaway([week("Suez Canal", 14, 3), week("Panama Canal", 15, -10)], "2021–2025"),
    ).toBe(
      "In the 7 days to 15 Nov 2026, tanker transits were within 25% of their 2021–2025 norm at every chokepoint shown.",
    );
  });

  it("returns nothing without a comparison", () => {
    expect(chokepointTakeaway([week("Suez Canal", 14, null)], "2021–2025")).toBeUndefined();
  });
});
