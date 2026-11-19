import "server-only";

/**
 * Timing logs, one JSON line each, readable in Vercel → Logs → Runtime Logs (ADR 0011).
 *
 * Added to find where live pages spend about 3 s before their data streams in: `data_timing` is
 * what a page waits for (cache lookups included), `db_query` marks a query that actually reached
 * the database (a cache miss), and `instance_age` tells a cold server instance from a warm one.
 * No query values, request data or personal data are logged.
 */

/** When this server instance loaded the module: a proxy for its start. */
const INSTANCE_STARTED_AT = Date.now();

export function logTiming(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...fields }));
}

/** Seconds since this server instance started. */
export function instanceAgeSeconds(): number {
  return Math.round((Date.now() - INSTANCE_STARTED_AT) / 1000);
}

/** Await `promise` and log how long it took under `label`. */
export async function timed<T>(label: string, promise: Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await promise;
  } finally {
    logTiming("data_timing", { label, ms: Math.round(performance.now() - start) });
  }
}
