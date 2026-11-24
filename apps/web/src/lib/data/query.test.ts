import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const resetDb = vi.fn();
const fakeSql = {};
vi.mock("./db", () => ({ db: () => fakeSql, resetDb }));

const { QueryTimeoutError } = await import("./timing");
const { ATTEMPT_MS, query } = await import("./query");

const never = () => new Promise<never>(() => undefined);

afterEach(() => {
  vi.useRealTimers();
  resetDb.mockClear();
});

describe("query", () => {
  it("returns the rows of a query that finishes in time", async () => {
    const run = vi.fn(() => Promise.resolve([1, 2]));
    await expect(query("ok", run)).resolves.toEqual([1, 2]);
    expect(run).toHaveBeenCalledWith(fakeSql);
    expect(resetDb).not.toHaveBeenCalled();
  });

  it("retries once on a fresh pool after a hung attempt", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockImplementationOnce(never).mockResolvedValueOnce(["rows"]);
    const result = query("flaky", run);
    await vi.advanceTimersByTimeAsync(ATTEMPT_MS);
    await expect(result).resolves.toEqual(["rows"]);
    expect(run).toHaveBeenCalledTimes(2);
    expect(resetDb).toHaveBeenCalledOnce();
  });

  it("rejects after two hung attempts, so the cached function fails instead of hanging", async () => {
    vi.useFakeTimers();
    const run = vi.fn(never);
    const result = query("hung", run);
    const assertion = expect(result).rejects.toBeInstanceOf(QueryTimeoutError);
    await vi.advanceTimersByTimeAsync(2 * ATTEMPT_MS);
    await assertion;
    expect(run).toHaveBeenCalledTimes(2);
    expect(resetDb).toHaveBeenCalledTimes(2);
  });

  it("does not retry a database error", async () => {
    const run = vi.fn(() => Promise.reject(new Error("syntax error")));
    await expect(query("bad", run)).rejects.toThrow("syntax error");
    expect(run).toHaveBeenCalledOnce();
    expect(resetDb).not.toHaveBeenCalled();
  });
});
