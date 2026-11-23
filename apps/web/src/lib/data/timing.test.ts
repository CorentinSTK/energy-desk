import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const resetDb = vi.fn();
vi.mock("./db", () => ({ resetDb }));

const { QueryTimeoutError, timed } = await import("./timing");

afterEach(() => {
  vi.useRealTimers();
  resetDb.mockClear();
});

describe("timed", () => {
  it("returns the result of a load that finishes in time", async () => {
    await expect(timed("ok", Promise.resolve(42), 50)).resolves.toBe(42);
    expect(resetDb).not.toHaveBeenCalled();
  });

  it("fails a load that never finishes and resets the pool", async () => {
    vi.useFakeTimers();
    const never = new Promise<number>(() => undefined);
    const result = timed("hung", never, 1000);
    vi.advanceTimersByTime(1000);
    await expect(result).rejects.toBeInstanceOf(QueryTimeoutError);
    expect(resetDb).toHaveBeenCalledOnce();
  });
});
