import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ErrorState } from "@/components/error-state";
import { RelatedPresets } from "@/components/lab/related-presets";
import { ChartCardSkeleton, KpiCardSkeleton } from "@/components/loading-skeletons";
import { MarketHeader, MarketKpis } from "@/components/market-header";
import { TabNav } from "@/components/markets/tab-nav";
import { Card, CardContent } from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/data/db";
import { loadContext, type PageContext } from "@/lib/data/page-context";

import { type Fuel, parseProductsParams, productsHref, type Tab, TABS } from "./data";
import {
  BalanceTab,
  FlowsTab,
  GapsTab,
  MainCrackChart,
  PositioningTab,
  PricesTab,
  ProductsKpis,
} from "./sections";

export const metadata: Metadata = {
  title: "Refined products — Energy Desk",
  description:
    "US refining margins and product prices, gasoline and diesel stocks against their five-year range, EU pump prices by country and product positioning.",
};

const KPI_COUNT = 4;

export default function ProductsPage({ searchParams }: PageProps<"/markets/products">) {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8">
      <MarketHeader
        commodity="products"
        title="Refined products"
        description="How profitable is refining, are fuel stocks high or low for the season, and what do Europeans pay at the pump?"
      />
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProductsContent({
  searchParams,
}: {
  searchParams: PageProps<"/markets/products">["searchParams"];
}) {
  const { tab, fuel } = parseProductsParams(await searchParams);
  // Request time: freshness and "current year" depend on today, never on the build date.
  await connection();
  const ctx = isDatabaseConfigured() ? await loadContext(new Date(), "products") : null;

  if (!ctx) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            title="Refined products data is unavailable"
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
          <ProductsKpis ctx={ctx} />
        </Suspense>
      </MarketKpis>

      <Suspense fallback={<ChartCardSkeleton height={320} />}>
        <MainCrackChart ctx={ctx} />
      </Suspense>

      <section className="space-y-4" aria-label="Details">
        <TabNav tabs={[...TABS]} active={tab} hrefFor={(id) => productsHref(id as Tab, fuel.id)} />
        <Suspense key={`${tab}-${fuel.id}`} fallback={<ChartCardSkeleton height={280} />}>
          <TabContent tab={tab} fuel={fuel} ctx={ctx} />
        </Suspense>
      </section>

      <p className="text-sm text-muted-foreground">
        Every series on this page, with its licence and freshness, is listed in the{" "}
        <Link href="/data?commodity=products" className="text-primary underline underline-offset-2">
          data catalogue
        </Link>
        .
      </p>
      <RelatedPresets ids={["crack_low_percentile", "diesel_crack_low_stocks"]} />
    </>
  );
}

function TabContent({ tab, fuel, ctx }: { tab: Tab; fuel: Fuel; ctx: PageContext }) {
  switch (tab) {
    case "prices":
      return <PricesTab ctx={ctx} fuel={fuel} />;
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

function ProductsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading refined products data">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: KPI_COUNT }, (_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <ChartCardSkeleton height={320} />
    </div>
  );
}
