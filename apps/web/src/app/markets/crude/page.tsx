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

import { parseTab, type Tab, TABS, tabHref } from "./data";
import {
  BalanceTab,
  CrudeKpis,
  FlowsTab,
  GapsTab,
  MainPriceChart,
  PositioningTab,
  PricesTab,
} from "./sections";

export const metadata: Metadata = {
  title: "Crude oil — Energy Desk",
  description:
    "Brent and WTI spot prices, futures curve structure, US crude stocks against their five-year range, the world oil balance and WTI positioning.",
};

const KPI_COUNT = 4;

export default function CrudePage({ searchParams }: PageProps<"/markets/crude">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <Suspense fallback={<CrudeSkeleton />}>
        <CrudeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CrudeContent({
  searchParams,
}: {
  searchParams: PageProps<"/markets/crude">["searchParams"];
}) {
  const tab = parseTab(await searchParams);
  // Request time: freshness and "current year" depend on today, never on the build date.
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "crude") : null;

  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Crude oil data is unavailable"
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
        commodity="crude"
        title="Crude oil"
        description="Where are crude prices, is the curve tight, and are stocks high or low for the season?"
      >
        <Suspense
          fallback={Array.from({ length: KPI_COUNT }, (_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        >
          <CrudeKpis ctx={ctx} />
        </Suspense>
      </MarketHeader>

      <Suspense fallback={<ChartCardSkeleton height={320} />}>
        <MainPriceChart ctx={ctx} />
      </Suspense>

      <section className="space-y-4" aria-label="Details">
        <TabNav tabs={[...TABS]} active={tab} hrefFor={(id) => tabHref(id as Tab)} />
        <Suspense key={tab} fallback={<ChartCardSkeleton height={280} />}>
          <TabContent tab={tab} ctx={ctx} />
        </Suspense>
      </section>

      <p className="text-sm text-muted-foreground">
        Every series on this page, with its licence and freshness, is listed in the{" "}
        <Link
          href="/data?commodity=crude"
          className="text-primary underline-offset-2 hover:underline"
        >
          data catalogue
        </Link>
        .
      </p>
      <RelatedForecasts ids={["us_crude_stocks"]} />
    </>
  );
}

function TabContent({ tab, ctx }: { tab: Tab; ctx: PageContext }) {
  switch (tab) {
    case "prices":
      return <PricesTab ctx={ctx} />;
    case "balance":
      return <BalanceTab ctx={ctx} />;
    case "flows":
      return <FlowsTab ctx={ctx} />;
    case "positioning":
      return <PositioningTab ctx={ctx} />;
    case "gaps":
      return <GapsTab />;
  }
}

function CrudeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading crude oil data">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: KPI_COUNT }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton height={320} />
    </div>
  );
}
