import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ErrorState } from "@/components/error-state";
import { ChartCardSkeleton, KpiCardSkeleton } from "@/components/loading-skeletons";
import { MarketHeader } from "@/components/market-header";
import { TabNav } from "@/components/markets/tab-nav";
import { Card, CardContent } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/data/db";
import { loadContext, type PageContext } from "@/lib/data/page-context";

import { type LngArea, lngHref, type LngTab, parseLngParams, TABS } from "./data";
import {
  LngFlowsTab,
  LngGapsTab,
  LngKpis,
  LngPositioningTab,
  LngPricesTab,
  MainSendOutChart,
  TerminalsTab,
} from "./sections";

export const metadata: Metadata = {
  title: "European LNG — Energy Desk",
  description: "EU LNG terminal send-out against its five-year range, tank inventories by country.",
};

const KPI_COUNT = 3;

export default function LngPage({ searchParams }: PageProps<"/markets/lng">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <Suspense fallback={<LngSkeleton />}>
        <LngContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LngContent({
  searchParams,
}: {
  searchParams: PageProps<"/markets/lng">["searchParams"];
}) {
  const { tab, area } = parseLngParams(await searchParams);
  // Request time: freshness and "current year" depend on today, never on the build date.
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "lng") : null;

  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="LNG market data is unavailable"
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
        commodity="lng"
        title="European LNG"
        description="Is Europe regasifying more or less LNG than usual, and how full are the terminal tanks?"
      >
        <Suspense
          fallback={Array.from({ length: KPI_COUNT }, (_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        >
          <LngKpis ctx={ctx} />
        </Suspense>
      </MarketHeader>

      <Suspense key={area} fallback={<ChartCardSkeleton height={320} />}>
        <MainSendOutChart ctx={ctx} area={area} />
      </Suspense>

      <section className="space-y-4" aria-label="Details">
        <TabNav tabs={[...TABS]} active={tab} hrefFor={(id) => lngHref(id as LngTab, area)} />
        <Suspense key={`${tab}-${area}`} fallback={<ChartCardSkeleton height={280} />}>
          <TabContent tab={tab} area={area} ctx={ctx} />
        </Suspense>
      </section>

      <p className="text-sm text-muted-foreground">
        Every series on this page, with its licence and freshness, is listed in the{" "}
        <Link
          href="/data?commodity=lng"
          className="text-primary underline-offset-2 hover:underline"
        >
          data catalogue
        </Link>
        .
      </p>
    </>
  );
}

function TabContent({ tab, area, ctx }: { tab: LngTab; area: LngArea; ctx: PageContext }) {
  switch (tab) {
    case "terminals":
      return <TerminalsTab ctx={ctx} area={area} />;
    case "prices":
      return <LngPricesTab />;
    case "flows":
      return <LngFlowsTab />;
    case "positioning":
      return <LngPositioningTab />;
    case "gaps":
      return <LngGapsTab />;
  }
}

function LngSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading LNG market data">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: KPI_COUNT }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton height={320} />
    </div>
  );
}
