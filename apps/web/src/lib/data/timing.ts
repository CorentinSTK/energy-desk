import "server-only";

/**
 * Time limits and timing logs for data loads, one JSON line each, readable in Vercel → Logs → Runtime
 * Logs (ADR 0011, 0012). No query values, request data or personal data are logged.
 *
 * - `slow_data`: a load slower than SLOW_MS (e.g. the 2.5 s catalogue scan fixed by migration 009).
 * - `query_timeout`: a load that did not finish within TIMEOUT_MS. On Vercel, a frozen instance can
 *   wake up with dead database connections, and a query sent on one would wait forever, keeping the
 *   page open until the platform kills it after 300 s. The load fails instead (its card shows the
 *   error state) and the pool is reset so the next request reconnects.
 */

import { resetDb } from "./db";

const SLOW_MS = 500;
export const TIMEOUT_MS = 10_000;

export class QueryTimeoutError extends Error {
  constructor(label: string, limitMs: number = TIMEOUT_MS) {
    super(`${label} did not finish within ${limitMs} ms`);
    this.name = "QueryTimeoutError";
  }
}

/**
 * Reject with QueryTimeoutError if `promise` has not settled after `limitMs`; `onTimeout` runs first.
 * The underlying work is not cancelled, only abandoned.
 */
export async function withTimeout<T>(
  label: string,
  promise: Promise<T>,
  limitMs: number,
  onTimeout: () => void = () => undefined,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new QueryTimeoutError(label, limitMs));
    }, limitMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Await a page-level data load with a time limit; log it if slow or timed out.
 *
 * A safety net only: each SQL query already has its own, shorter limit inside the cached function
 * (`query` in query.ts). This limit sits outside the `use cache` boundary, so on its own it cannot
 * free a cache entry whose generation hangs.
 */
export async function timed<T>(
  label: string,
  promise: Promise<T>,
  limitMs = TIMEOUT_MS,
): Promise<T> {
  const start = performance.now();
  try {
    return await withTimeout(label, promise, limitMs, () => {
      console.log(JSON.stringify({ event: "query_timeout", label, ms: limitMs }));
      resetDb();
    });
  } finally {
    const ms = Math.round(performance.now() - start);
    if (ms > SLOW_MS && ms < limitMs)
      console.log(JSON.stringify({ event: "slow_data", label, ms }));
  }
}
