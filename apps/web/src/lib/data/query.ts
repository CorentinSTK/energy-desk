import "server-only";

import type postgres from "postgres";

import { db, resetDb } from "./db";
import { QueryTimeoutError, withTimeout } from "./timing";

/** Time limit for one attempt of one SQL query. Two attempts fit inside the page-level TIMEOUT_MS. */
export const ATTEMPT_MS = 4_000;
const ATTEMPTS = 2;

/**
 * Run one SQL query with a time limit and one retry on a fresh pool. Call it inside every
 * `use cache` function, never around one.
 *
 * Why inside: Next's in-memory cache handler keeps a "pending" entry while a cached function runs,
 * and every later read of the same key on that instance waits for it. If the query hangs on a dead
 * connection (a frozen serverless instance), the entry never settles, and that card fails on every
 * request served by the instance, whatever the outer limit does. Failing here instead makes the
 * generation reject: nothing is cached, the pending entry is released, and the next request
 * queries again.
 *
 * `run` receives the client and returns the query, so a retry can rebuild it on the new pool.
 */
export async function query<R>(label: string, run: (sql: postgres.Sql) => Promise<R>): Promise<R> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await withTimeout(label, run(db()), ATTEMPT_MS);
    } catch (error) {
      if (!(error instanceof QueryTimeoutError)) throw error;
      console.log(JSON.stringify({ event: "query_timeout", label, attempt, ms: ATTEMPT_MS }));
      resetDb();
      if (attempt >= ATTEMPTS) throw error;
    }
  }
}
