import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { FilterBar } from "@/components/data/filter-bar";
import { RunsTable } from "@/components/data/runs-table";
import { SeriesTable } from "@/components/data/series-table";
import { DataGapNotice } from "@/components/data-gap-notice";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { extractionDates } from "@/lib/data/attribution";
import { getRecentRuns, getSeriesCatalog } from "@/lib/data/catalog";
import { isDatabaseConfigured } from "@/lib/data/db";
import { describeDatabaseError } from "@/lib/data/errors";
import { DECLARED_GAPS } from "@/lib/data/declared-gaps";
import { parseFilters } from "@/lib/data/filters";
import { formatNumber } from "@/lib/format";
import { freshnessStatus, type FreshnessStatus } from "@/lib/freshness";

export const metadata: Metadata = {
  title: "Data catalogue — Energy Desk",
  description: "Every series on Energy Desk: source, unit, frequency, licence, freshness and gaps.",
};

export default function DataPage({ searchParams }: PageProps<"/data">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Data catalogue</h1>
          <p className="max-w-3xl text-text-secondary">
            Every series on this site: where it comes from, its unit and licence, how fresh it is,
            and where it has gaps. Missing data is shown as missing, never estimated.
          </p>
        </div>
      </header>

      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Not covered, and why</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {DECLARED_GAPS.map((gap) => (
            <DataGapNotice key={gap.title} title={gap.title} reason={gap.reason} />
          ))}
        </div>
      </section>
    </main>
  );
}

async function Catalog({ searchParams }: { searchParams: PageProps<"/data">["searchParams"] }) {
  const filters = parseFilters(await searchParams);
  // Render at request time: freshness depends on the current time, never the build time.
  await connection();
  const configured = isDatabaseConfigured();
  let data;
  try {
    data = configured ? await Promise.all([getSeriesCatalog(), getRecentRuns()]) : undefined;
  } catch (error) {
    // Shown to visitors as a generic error state; the cause goes to the server logs (Vercel → Logs).
    console.error(`[data] catalogue query failed: ${describeDatabaseError(error)}`);
    data = undefined;
  }
  if (data === undefined) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="The data catalogue is unavailable"
            description={
              !configured
                ? "The database connection is not configured for this deployment."
                : "Our database did not respond. Try again in a few minutes."
            }
          />
        </CardContent>
      </Card>
    );
  }

  const [catalog, runs] = data;
  const now = new Date();
  const series = catalog.filter(
    (s) =>
      (!filters.commodity || s.commodity === filters.commodity) &&
      (!filters.source || s.source === filters.source),
  );
  const visibleRuns = runs.filter((r) => !filters.source || r.source === filters.source);

  return (
    <div className="space-y-8">
      <Summary
        catalog={catalog}
        now={now}
        problemRuns={runs.filter((r) => r.status !== "ok").length}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Series</h2>
        <FilterBar filters={filters} />
        {series.length > 0 ? (
          <SeriesTable series={series} now={now} extractionDates={extractionDates(runs)} />
        ) : (
          <Card>
            <CardContent>
              <EmptyState
                title="No series match these filters"
                description="Remove a filter to see more."
              />
            </CardContent>
          </Card>
        )}
      </section>
      {/* Below the fold and long (hundreds of runs): laid out only when scrolled near. */}
      <section className="space-y-3 [contain-intrinsic-size:auto_1200px] [content-visibility:auto]">
        <h2 className="text-lg font-semibold">Ingestion runs, last 30 days</h2>
        {visibleRuns.length > 0 ? (
          <RunsTable runs={visibleRuns} />
        ) : (
          <Card>
            <CardContent>
              <EmptyState title="No ingestion runs in the last 30 days" />
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function Summary({
  catalog,
  now,
  problemRuns,
}: {
  catalog: Awaited<ReturnType<typeof getSeriesCatalog>>;
  now: Date;
  problemRuns: number;
}) {
  const counts: Record<FreshnessStatus | "empty", number> = {
    fresh: 0,
    delayed: 0,
    stale: 0,
    empty: 0,
  };
  for (const s of catalog) {
    if (!s.lastObservation) counts.empty += 1;
    else
      counts[
        freshnessStatus(new Date(s.lastObservation), s.frequency, now, s.publicationLagDays)
      ] += 1;
  }
  const stats = [
    { label: "Series", value: catalog.length },
    { label: "Sources", value: new Set(catalog.map((s) => s.source)).size },
    { label: "Fresh", value: counts.fresh },
    { label: "Delayed or stale", value: counts.delayed + counts.stale },
    { label: "Runs with problems (30 d)", value: problemRuns },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        // A single div may group a dt and its dd inside a dl; a card's nested wrappers may not.
        <div key={stat.label} className="rounded-xl border bg-card px-6 py-4 text-card-foreground">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {stat.label}
          </dt>
          <dd className="text-2xl font-semibold">{formatNumber(stat.value, 0)}</dd>
        </div>
      ))}
    </dl>
  );
}

function CatalogSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading the data catalogue">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
