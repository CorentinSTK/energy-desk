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
  constructor(label: string) {
    super(`${label} did not finish within ${TIMEOUT_MS} ms`);
    this.name = "QueryTimeoutError";
  }
}

/** Await `promise` with a time limit; log it if slow or timed out. */
export async function timed<T>(
  label: string,
  promise: Promise<T>,
  limitMs = TIMEOUT_MS,
): Promise<T> {
  const start = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      console.log(JSON.stringify({ event: "query_timeout", label, ms: limitMs }));
      resetDb();
      reject(new QueryTimeoutError(label));
    }, limitMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
    const ms = Math.round(performance.now() - start);
    if (ms > SLOW_MS && ms < limitMs)
      console.log(JSON.stringify({ event: "slow_data", label, ms }));
  }
}
