import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { daysAgo } = await import("./page-context");

describe("daysAgo", () => {
  it("starts the window at midnight UTC", () => {
    expect(daysAgo(new Date("2026-10-31T07:15:42.123Z"), 30)).toBe("2026-10-01T00:00:00.000Z");
  });

  it("is the same all day, so cached queries keep one key per day", () => {
    const morning = daysAgo(new Date("2026-10-31T00:00:00.000Z"), 365);
    const evening = daysAgo(new Date("2026-10-31T23:59:59.999Z"), 365);
    expect(evening).toBe(morning);
    expect(daysAgo(new Date("2026-11-01T00:00:00.000Z"), 365)).not.toBe(morning);
  });
});
