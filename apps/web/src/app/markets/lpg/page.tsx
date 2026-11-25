import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ErrorState } from "@/components/error-state";
import { ChartCardSkeleton, KpiCardSkeleton } from "@/components/loading-skeletons";
import { MarketHeader, MarketKpis } from "@/components/market-header";
import { TabNav } from "@/components/markets/tab-nav";
import { Card, CardContent } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/data/db";
import { loadContext, type PageContext } from "@/lib/data/page-context";

import { lpgHref, parseLpgParams, type Tab, TABS } from "./data";
import { BalanceTab, FlowsTab, GapsTab, LpgKpis, MainRatioChart, PricesTab } from "./sections";

export const metadata: Metadata = {
  title: "LPG (propane) — Energy Desk",
  description:
    "Mont Belvieu propane against crude, US propane stocks against their five-year range, US demand and exports.",
};

const KPI_COUNT = 4;

export default function LpgPage({ searchParams }: PageProps<"/markets/lpg">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <MarketHeader
        commodity="lpg"
        title="LPG (propane)"
        description="Is propane cheap or dear against crude, are US stocks high or low for the season, and how much is the US exporting?"
      />
      <Suspense fallback={<LpgSkeleton />}>
        <LpgContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LpgContent({
  searchParams,
}: {
  searchParams: PageProps<"/markets/lpg">["searchParams"];
}) {
  const { tab } = parseLpgParams(await searchParams);
  // Request time: freshness and "current year" depend on today, never on the build date.
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "lpg") : null;

  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="LPG data is unavailable"
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
          fallback={Array.from({ length: KPI_COUNT }, (_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        >
          <LpgKpis ctx={ctx} />
        </Suspense>
      </MarketKpis>

      <Suspense fallback={<ChartCardSkeleton height={320} />}>
        <MainRatioChart ctx={ctx} />
      </Suspense>

      <section className="space-y-4" aria-label="Details">
        <TabNav tabs={[...TABS]} active={tab} hrefFor={(id) => lpgHref(id as Tab)} />
        <Suspense key={tab} fallback={<ChartCardSkeleton height={280} />}>
          <TabContent tab={tab} ctx={ctx} />
        </Suspense>
      </section>

      <p className="text-sm text-muted-foreground">
        Every series on this page, with its licence and freshness, is listed in the{" "}
        <Link href="/data?commodity=lpg" className="text-primary underline underline-offset-2">
          data catalogue
        </Link>
        .
      </p>
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
    case "gaps":
      return <GapsTab />;
  }
}

function LpgSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading LPG data">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: KPI_COUNT }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton height={320} />
    </div>
  );
}
