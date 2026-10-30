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

import { parsePowerParams, powerHref, type PowerTab, type PowerZone, TABS } from "./data";
import {
  BalanceTab,
  FlowsTab,
  GapsTab,
  MainPriceChart,
  PositioningTab,
  PowerKpis,
  PricesTab,
  ZoneNav,
} from "./sections";

export const metadata: Metadata = {
  title: "European power — Energy Desk",
  description:
    "Day-ahead power prices against their five-year range, demand and generation mix for Germany, France and Great Britain.",
};

const KPI_COUNT = 4;

export default function PowerPage({ searchParams }: PageProps<"/markets/power">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <Suspense fallback={<PowerSkeleton />}>
        <PowerContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function PowerContent({
  searchParams,
}: {
  searchParams: PageProps<"/markets/power">["searchParams"];
}) {
  const { tab, zone } = parsePowerParams(await searchParams);
  // Request time: freshness and "current year" depend on today, never on the build date.
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "power") : null;

  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Power market data is unavailable"
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
        commodity="power"
        title="European power"
        description="Are power prices high for the season, how much is being consumed, and what is generating it?"
      >
        <Suspense
          key={zone.id}
          fallback={Array.from({ length: KPI_COUNT }, (_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        >
          <PowerKpis ctx={ctx} zone={zone} />
        </Suspense>
      </MarketHeader>

      <ZoneNav tab={tab} zone={zone} />

      <Suspense key={zone.id} fallback={<ChartCardSkeleton height={320} />}>
        <MainPriceChart ctx={ctx} zone={zone} />
      </Suspense>

      <section className="space-y-4" aria-label="Details">
        <TabNav
          tabs={[...TABS]}
          active={tab}
          hrefFor={(id) => powerHref(id as PowerTab, zone.id)}
        />
        <Suspense key={`${tab}-${zone.id}`} fallback={<ChartCardSkeleton height={280} />}>
          <TabContent tab={tab} zone={zone} ctx={ctx} />
        </Suspense>
      </section>

      <p className="text-sm text-muted-foreground">
        Every series on this page, with its licence and freshness, is listed in the{" "}
        <Link
          href="/data?commodity=power"
          className="text-primary underline-offset-2 hover:underline"
        >
          data catalogue
        </Link>
        .
      </p>
      <RelatedForecasts ids={["fr_power_demand"]} />
    </>
  );
}

function TabContent({ tab, zone, ctx }: { tab: PowerTab; zone: PowerZone; ctx: PageContext }) {
  switch (tab) {
    case "prices":
      return <PricesTab ctx={ctx} zone={zone} />;
    case "balance":
      return <BalanceTab ctx={ctx} zone={zone} />;
    case "flows":
      return <FlowsTab ctx={ctx} zone={zone} />;
    case "positioning":
      return <PositioningTab />;
    case "gaps":
      return <GapsTab />;
  }
}

function PowerSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading power market data">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: KPI_COUNT }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton height={320} />
    </div>
  );
}
