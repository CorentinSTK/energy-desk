import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ErrorState } from "@/components/error-state";
import { RelatedForecasts } from "@/components/forecasts/related-forecasts";
import { ChartCardSkeleton, KpiCardSkeleton } from "@/components/loading-skeletons";
import { MarketHeader } from "@/components/market-header";
import { TabNav } from "@/components/markets/tab-nav";
import { Card, CardContent } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/data/db";

import { loadContext, type PageContext } from "@/lib/data/page-context";

import { type GasTab, gasHref, parseGasParams, type StorageArea, TABS } from "./data";
import {
  FlowsTab,
  GapsTab,
  GasKpis,
  MainStorageChart,
  PositioningTab,
  PricesTab,
  StorageTab,
} from "./sections";

export const metadata: Metadata = {
  title: "European natural gas — Energy Desk",
  description:
    "EU gas storage against its five-year range, entry flows, TTF curve indicators and the official monthly benchmark.",
};

const KPI_COUNT = 4;

export default function GasPage({ searchParams }: PageProps<"/markets/gas">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <Suspense fallback={<GasSkeleton />}>
        <GasContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function GasContent({
  searchParams,
}: {
  searchParams: PageProps<"/markets/gas">["searchParams"];
}) {
  const { tab, area } = parseGasParams(await searchParams);
  // Request time: freshness and "current year" depend on today, never on the build date.
  await connection();
  const now = new Date();
  const ctx = isDatabaseConfigured() ? await loadContext(now, "gas") : null;

  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Gas market data is unavailable"
            description={
              isDatabaseConfigured()
                ? "Our database did not respond. Try again in a few minutes."
                : "The database connection is not configured for this deployment."
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <MarketHeader
        commodity="natgas"
        title="European natural gas"
        description="Are EU gas stocks tight for the season, where is gas flowing in, and what does the prompt curve say?"
      >
        <Suspense
          fallback={Array.from({ length: KPI_COUNT }, (_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        >
          <GasKpis ctx={ctx} />
        </Suspense>
      </MarketHeader>

      <Suspense fallback={<ChartCardSkeleton height={320} />}>
        <MainStorageChart ctx={ctx} />
      </Suspense>

      <section className="space-y-4" aria-label="Details">
        <TabNav tabs={[...TABS]} active={tab} hrefFor={(id) => gasHref(id as GasTab, area)} />
        <Suspense key={`${tab}-${area}`} fallback={<ChartCardSkeleton height={280} />}>
          <TabContent tab={tab} area={area} ctx={ctx} />
        </Suspense>
      </section>

      <p className="text-sm text-muted-foreground">
        Every series on this page, with its licence and freshness, is listed in the{" "}
        <Link
          href="/data?commodity=natgas"
          className="text-primary underline underline-offset-2"
        >
          data catalogue
        </Link>
        .
      </p>
      <RelatedForecasts ids={["eu_storage_30d"]} />
    </>
  );
}

function TabContent({ tab, area, ctx }: { tab: GasTab; area: StorageArea; ctx: PageContext }) {
  switch (tab) {
    case "prices":
      return <PricesTab ctx={ctx} />;
    case "storage":
      return <StorageTab ctx={ctx} area={area} />;
    case "flows":
      return <FlowsTab ctx={ctx} />;
    case "positioning":
      return <PositioningTab />;
    case "gaps":
      return <GapsTab />;
  }
}

function GasSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading gas market data">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: KPI_COUNT }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton height={320} />
    </div>
  );
}
