/**
 * A loggable description of a database error: name, Postgres or Node error code, and message, with
 * any credentials in a connection URL masked. Never includes the connection string itself.
 */
export function describeDatabaseError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as { code?: unknown }).code;
  const message = error.message.replace(/\/\/[^/@\s]*@/g, "//***@");
  return `${error.name}${code ? ` [${String(code)}]` : ""}: ${message}`;
}
