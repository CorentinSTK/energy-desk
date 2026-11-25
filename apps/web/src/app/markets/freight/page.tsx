import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ErrorState } from "@/components/error-state";
import { ChartCardSkeleton, KpiCardSkeleton } from "@/components/loading-skeletons";
import { MarketHeader, MarketKpis } from "@/components/market-header";
import { VesselClasses } from "@/components/freight/vessel-classes";
import { TabNav } from "@/components/markets/tab-nav";
import { Card, CardContent } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/data/db";
import { loadContext, type PageContext } from "@/lib/data/page-context";
import type { ChokepointId } from "@/lib/freight/chokepoints";

import { type FreightTab, freightHref, parseFreightParams, TABS } from "./data";
import {
  ChokepointsTab,
  FreightGapsTab,
  FreightKpis,
  KPI_CHOKEPOINTS,
  MainChokepointChart,
  RoutesTab,
} from "./sections";

export const metadata: Metadata = {
  title: "Freight & shipping — Energy Desk",
  description:
    "Daily tanker transits through the oil and LNG chokepoints (IMF PortWatch), disruption events, and computed voyage times via Suez, Panama or the Cape.",
};

export default function FreightPage({ searchParams }: PageProps<"/markets/freight">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <MarketHeader
        commodity="freight"
        title="Freight & shipping"
        description="Are the oil and LNG chokepoints open, and how much longer is the way around?"
      />
      <Suspense fallback={<FreightSkeleton />}>
        <FreightContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function FreightContent({
  searchParams,
}: {
  searchParams: PageProps<"/markets/freight">["searchParams"];
}) {
  const { tab, strait } = parseFreightParams(await searchParams);
  // Request time: freshness and "current year" depend on today, never on the build date.
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "freight") : null;

  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Shipping data is unavailable"
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
      <MarketKpis>
        <Suspense
          fallback={KPI_CHOKEPOINTS.map((id) => (
            <KpiCardSkeleton key={id} />
          ))}
        >
          <FreightKpis ctx={ctx} />
        </Suspense>
      </MarketKpis>

      <Suspense fallback={<ChartCardSkeleton height={340} />}>
        <MainChokepointChart ctx={ctx} />
      </Suspense>

      <section className="space-y-4" aria-label="Details">
        <TabNav
          tabs={[...TABS]}
          active={tab}
          hrefFor={(id) => freightHref(id as FreightTab, strait)}
        />
        <Suspense key={`${tab}-${strait}`} fallback={<ChartCardSkeleton height={280} />}>
          <TabContent tab={tab} strait={strait} ctx={ctx} />
        </Suspense>
      </section>

      <VesselClasses />

      <p className="text-sm text-muted-foreground">
        Every series on this page, with its licence and freshness, is listed in the{" "}
        <Link href="/data?commodity=freight" className="text-primary underline underline-offset-2">
          data catalogue
        </Link>
        .
      </p>
    </>
  );
}

function TabContent({
  tab,
  strait,
  ctx,
}: {
  tab: FreightTab;
  strait: ChokepointId;
  ctx: PageContext;
}) {
  switch (tab) {
    case "chokepoints":
      return <ChokepointsTab ctx={ctx} strait={strait} />;
    case "routes":
      return <RoutesTab />;
    case "gaps":
      return <FreightGapsTab />;
  }
}

function FreightSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading shipping data">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CHOKEPOINTS.map((id) => (
          <KpiCardSkeleton key={id} />
        ))}
      </div>
      <ChartCardSkeleton height={340} />
    </div>
  );
}
