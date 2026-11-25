import { describe, expect, it } from "vitest";

import type { Points } from "@/lib/data/series";
import { targetWindow, windowResult } from "@/lib/gas/storage-target";

describe("targetWindow", () => {
  it("uses this year's window from October", () => {
    expect(targetWindow(new Date("2026-11-25T12:00:00Z"))).toEqual({
      start: "2026-10-01",
      end: "2026-12-01",
      open: true,
    });
  });
  it("uses last year's (closed) window before October", () => {
    expect(targetWindow(new Date("2026-03-10T00:00:00Z"))).toEqual({
      start: "2025-10-01",
      end: "2025-12-01",
      open: false,
    });
  });
  it("is closed after 1 December", () => {
    expect(targetWindow(new Date("2026-12-15T00:00:00Z")).open).toBe(false);
  });
});

describe("windowResult", () => {
  const w = { start: "2026-10-01", end: "2026-12-01", open: true };
  const points: Points = [
    ["2026-09-30T00:00:00Z", 95], // before the window: ignored
    ["2026-10-01T00:00:00Z", 88],
    ["2026-10-05T00:00:00Z", 90.2],
    ["2026-10-20T00:00:00Z", 91.5],
    ["2026-11-20T00:00:00Z", 84],
  ];
  it("finds the peak and the first day at the target inside the window", () => {
    expect(windowResult(points, w)).toEqual({
      peak: 91.5,
      peakDate: "2026-10-20",
      reachedOn: "2026-10-05",
      days: 4,
    });
  });
  it("has no reach date below the target, and null without data", () => {
    expect(windowResult([["2026-10-02T00:00:00Z", 70]], w)?.reachedOn).toBeNull();
    expect(windowResult([], w)).toBeNull();
  });
});
