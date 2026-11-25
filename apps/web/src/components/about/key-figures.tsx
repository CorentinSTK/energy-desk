import { connection } from "next/server";

import { getSeriesCatalog } from "@/lib/data/catalog";
import { isDatabaseConfigured } from "@/lib/data/db";
import { describeDatabaseError } from "@/lib/data/errors";
import { formatNumber } from "@/lib/format";
import { FORECAST_MODELS } from "@/lib/forecasts/models";

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-0.5 rounded-xl border bg-card p-3">
      <p className="font-mono text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Size of the project, read from the catalogue at request time (never typed in by hand). */
export async function KeyFigures() {
  await connection();
  let catalog;
  try {
    catalog = isDatabaseConfigured() ? await getSeriesCatalog() : null;
  } catch (error) {
    console.error(`[about] catalogue query failed: ${describeDatabaseError(error)}`);
    catalog = null;
  }
  if (!catalog) return null;
  const sources = new Set(catalog.map((s) => s.source)).size;
  const observations = catalog.reduce((sum, s) => sum + s.observationCount, 0);
  const firstYear = catalog
    .map((s) => s.firstObservation)
    .filter((d): d is string => d !== null)
    .sort()[0]
    ?.slice(0, 4);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Figure value={formatNumber(sources, 0)} label="sources ingested" />
      <Figure value={formatNumber(catalog.length, 0)} label="series in the catalogue" />
      <Figure value={formatNumber(observations, 0)} label="observations stored" />
      <Figure
        value={firstYear ?? "—"}
        label={`first observation · ${FORECAST_MODELS.length} forecast models`}
      />
    </div>
  );
}
