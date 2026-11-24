import "server-only";

import postgres from "postgres";

/**
 * Read-only database client for server components (ADR 0005).
 *
 * Connects as `web_reader`, which can only SELECT from views in the `web` schema. Uses the Supabase
 * pooler in transaction mode, so prepared statements are disabled. One small pool per server instance.
 * Queries format timestamps as ISO 8601 strings in SQL (with ISO_UTC below), so values cross caches
 * and client components unchanged.
 */

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL_READONLY is not set");
    this.name = "DatabaseNotConfiguredError";
  }
}

/**
 * Check this before calling a cached query: an error thrown inside `use cache` loses its class when
 * it crosses the cache boundary, so `instanceof DatabaseNotConfiguredError` cannot be relied on there.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL_READONLY);
}

let client: postgres.Sql | undefined;
let clientCreatedAt = 0;
let lastUsedAt = 0;

/** Pool age and time since its last query, in ms, for the `db_query` log (no query data). */
export function poolTimings(): { poolAgeMs: number; idleMs: number } {
  const now = Date.now();
  const timings = {
    poolAgeMs: client ? now - clientCreatedAt : 0,
    idleMs: client && lastUsedAt ? now - lastUsedAt : 0,
  };
  lastUsedAt = now;
  return timings;
}

export function db(): postgres.Sql {
  const url = process.env.DATABASE_URL_READONLY;
  if (!url) throw new DatabaseNotConfiguredError();
  if (!client) clientCreatedAt = Date.now();
  client ??= postgres(url, {
    prepare: false,
    // 10, not 3: with 3, a page firing many cached queries at once (the freight page, about 30)
    // starved the pool on a fresh instance. One query waited for a connection that never came
    // free, holding the page open until Vercel's 300 s limit. The Supabase pooler (transaction
    // mode) multiplexes these client connections, so 10 per instance is cheap.
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Recycle connections: a serverless instance is frozen between requests, and a connection
    // can die during the freeze without the client noticing.
    max_lifetime: 5 * 60,
  });
  return client;
}

/** Seconds the old pool gets to finish queries in flight after a reset, before its sockets close. */
const RESET_GRACE_S = 5;

/**
 * Swap in a new pool so the next query reconnects. Called when a query times out: its connection is
 * probably dead (frozen instance), and every query queued behind it would wait forever.
 *
 * The old pool is ended with a grace period, not at once: closing it immediately also failed the
 * healthy queries running beside the hung one.
 */
export function resetDb(): void {
  const old = client;
  client = undefined;
  lastUsedAt = 0;
  void old?.end({ timeout: RESET_GRACE_S }).catch(() => undefined);
}

/**
 * `to_char` format for an ISO 8601 UTC string, e.g. 2026-10-27T00:00:00Z. Passed as a bound
 * parameter: `to_char(ts at time zone 'UTC', ${ISO_UTC})`.
 */
export const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS"Z"';
