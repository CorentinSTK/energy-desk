/**
 * Attribution texts can contain `{extraction_date}`: some licences (ENTSOG TP, art. 5.2) require the
 * date the data was downloaded. It is filled with the date of the source's last successful ingestion
 * run, as DD-MM-YYYY. If no such run is known, the text says so instead of guessing a date.
 */

const PLACEHOLDER = "{extraction_date}";
const SUCCESSFUL = new Set(["ok", "partial"]);

interface RunLike {
  source: string;
  status: string;
  finishedAt: string | null;
}

/** Latest successful run per source → "DD-MM-YYYY" (UTC). */
export function extractionDates(runs: RunLike[]): Record<string, string> {
  const latest: Record<string, string> = {};
  for (const run of runs) {
    if (!SUCCESSFUL.has(run.status) || !run.finishedAt) continue;
    if (!latest[run.source] || run.finishedAt > latest[run.source])
      latest[run.source] = run.finishedAt;
  }
  return Object.fromEntries(
    Object.entries(latest).map(([source, iso]) => {
      const [y, m, d] = iso.slice(0, 10).split("-");
      return [source, `${d}-${m}-${y}`];
    }),
  );
}

export function resolveAttribution(
  text: string | null,
  source: string,
  dates: Record<string, string>,
): string | null {
  if (text === null || !text.includes(PLACEHOLDER)) return text;
  return text.replace(PLACEHOLDER, dates[source] ?? "extraction date unknown");
}
