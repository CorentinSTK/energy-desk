import "server-only";

/**
 * Slow data loads, one JSON line each, readable in Vercel → Logs → Runtime Logs (ADR 0011, 0012).
 *
 * Only loads slower than SLOW_MS are logged, so a regression such as the 2.5 s catalogue scan fixed
 * by migration 009 shows up without logging every request. No query values, request data or personal
 * data are logged.
 */

const SLOW_MS = 500;

/** Await `promise` and log it under `label` if it took longer than SLOW_MS. */
export async function timed<T>(label: string, promise: Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await promise;
  } finally {
    const ms = Math.round(performance.now() - start);
    if (ms > SLOW_MS) console.log(JSON.stringify({ event: "slow_data", label, ms }));
  }
}
