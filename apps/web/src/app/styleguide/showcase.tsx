import { SeasonalChart } from "@/components/charts/seasonal-chart";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ChartCard, type ChartSourceInfo } from "@/components/chart-card";
import { DataGapNotice } from "@/components/data-gap-notice";
import { DemoBanner } from "@/components/data-labels";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { FreshnessBadge } from "@/components/freshness-badge";
import { KpiCard } from "@/components/kpi-card";
import { KpiCardSkeleton } from "@/components/loading-skeletons";
import { MarketHeader } from "@/components/market-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { syntheticDailySeries, syntheticSeasonal } from "@/lib/demo/synthetic";
import { formatChange, formatNumber, formatPercentile, formatPercentChange } from "@/lib/format";

// Synthetic data only (see lib/demo/synthetic.ts). Ten years of daily points to exercise chart speed.
const DAILY = syntheticDailySeries({
  start: "2016-10-28",
  days: 3653,
  level: 70,
  amplitude: 12,
  seed: 7,
  gaps: [[3400, 3430]],
});
const SEASONAL = syntheticSeasonal(11, 43);
const CHART_HEIGHT = 260;

const DEMO_INFO: ChartSourceInfo = {
  source: "Synthetic (style guide)",
  attribution: "Attribution line appears here when the series licence requires one.",
  unit: "$/bbl",
  lastObservation: "2026-10-27",
  freshness: "fresh",
};

const DEMO_METHOD = (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>A synthetic series used to demonstrate the chart grammar.</p>
    <p className="font-medium text-foreground">How it is computed</p>
    <p>Sine wave plus seeded random drift. Not market data.</p>
  </>
);

const SWATCHES: { group: string; items: { name: string; className: string }[] }[] = [
  {
    group: "Surfaces",
    items: [
      { name: "background", className: "bg-background" },
      { name: "surface", className: "bg-surface" },
      { name: "surface-raised", className: "bg-surface-raised" },
      { name: "muted", className: "bg-muted" },
      { name: "border", className: "bg-border" },
      { name: "border-strong", className: "bg-border-strong" },
    ],
  },
  {
    group: "Text",
    items: [
      { name: "foreground", className: "bg-foreground" },
      { name: "text-secondary", className: "bg-text-secondary" },
      { name: "muted-foreground", className: "bg-muted-foreground" },
    ],
  },
  {
    group: "Semantic",
    items: [
      { name: "primary", className: "bg-primary" },
      { name: "positive", className: "bg-positive" },
      { name: "negative", className: "bg-negative" },
      { name: "warning", className: "bg-warning" },
    ],
  },
  {
    group: "Commodities",
    items: [
      { name: "crude", className: "bg-crude" },
      { name: "products", className: "bg-products" },
      { name: "natgas", className: "bg-natgas" },
      { name: "lng", className: "bg-lng" },
      { name: "lpg", className: "bg-lpg" },
      { name: "power", className: "bg-power" },
    ],
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Every core component, in every state. Rendered once per theme by the style guide page. */
export function Showcase() {
  return (
    <div className="space-y-10">
      <Section title="Colour tokens">
        <div className="space-y-3">
          {SWATCHES.map((group) => (
            <div key={group.group}>
              <p className="mb-1.5 text-xs text-text-secondary">{group.group}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <div key={item.name} className="w-20 space-y-1">
                    <div className={`h-8 rounded-md border ${item.className}`} />
                    <p className="truncate text-[11px] text-muted-foreground">{item.name}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography and numbers">
        <div className="space-y-2">
          <p className="text-2xl font-semibold tracking-tight">
            Are EU gas stocks tight for the season?
          </p>
          <p className="text-text-secondary">
            Secondary text: one plain-English takeaway sentence.
          </p>
          <p className="text-sm text-muted-foreground">Muted text: sources, units, dates.</p>
          <table className="text-sm">
            <tbody>
              {[
                ["Value", formatNumber(1234.5, 2)],
                ["Change", `${formatChange(1.2, 2)} / ${formatChange(-0.4, 2)}`],
                ["Percent change", formatPercentChange(-18.24)],
                ["Percentile", formatPercentile(92)],
                ["Missing", formatNumber(null)],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td className="pr-6 text-muted-foreground">{label}</td>
                  <td className="text-right font-medium">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <code className="block font-mono text-xs text-text-secondary">
            uv run python -m worker.ingest --source eia --dry-run
          </code>
        </div>
      </Section>

      <Section title="Primitives">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Badge</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <FreshnessBadge status="fresh" lastObservation="2026-10-27" />
          <FreshnessBadge status="delayed" lastObservation="2026-10-22" />
          <FreshnessBadge status="stale" lastObservation="2026-10-01" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup type="single" defaultValue="seasonal" variant="outline" size="sm">
            <ToggleGroupItem value="move">Today&apos;s move</ToggleGroupItem>
            <ToggleGroupItem value="percentile">Percentile</ToggleGroupItem>
            <ToggleGroupItem value="seasonal">vs seasonal</ToggleGroupItem>
          </ToggleGroup>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                Hover me
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip with a short hint</TooltipContent>
          </Tooltip>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                Open drawer
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>TTF hub</SheetTitle>
                <SheetDescription>
                  Side drawer used by the home map. Key numbers and a link to the market page.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
        <Tabs defaultValue="prices">
          <TabsList>
            <TabsTrigger value="prices">Prices & curve</TabsTrigger>
            <TabsTrigger value="balance">Balance & stocks</TabsTrigger>
            <TabsTrigger value="gaps">Data gaps</TabsTrigger>
          </TabsList>
          <TabsContent value="prices" className="pt-2 text-sm text-text-secondary">
            Tab content: benchmarks, curve, spreads.
          </TabsContent>
          <TabsContent value="balance" className="pt-2 text-sm text-text-secondary">
            Tab content: stocks vs seasonal range.
          </TabsContent>
          <TabsContent value="gaps" className="pt-2 text-sm text-text-secondary">
            Tab content: what is not covered and why.
          </TabsContent>
        </Tabs>
        <Accordion type="single" collapsible>
          <AccordionItem value="method">
            <AccordionTrigger>Accordion: detail on demand</AccordionTrigger>
            <AccordionContent className="text-text-secondary">
              Secondary detail stays folded until asked for.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title="Market header and KPI cards">
        <MarketHeader
          commodity="natgas"
          title="European natural gas"
          description="Are EU gas stocks tight for the season, and where is gas flowing?"
        >
          <KpiCard
            demo
            commodity="natgas"
            label="EU storage"
            value={78.4}
            unit="%"
            change={{ value: 0.6, label: "vs last week" }}
            context={[
              { label: "vs 5Y avg", value: formatPercentChange(-6.1) },
              { label: "Percentile", value: formatPercentile(18) },
            ]}
          />
          <KpiCard
            demo
            commodity="natgas"
            label="Front month"
            value={34.21}
            unit="€/MWh"
            change={{ value: -2.3, label: "vs yesterday", percent: true }}
          />
          <KpiCard
            demo
            commodity="natgas"
            label="Missing value"
            value={null}
            unit="GWh/d"
            change={{ value: null, label: "vs last week" }}
          />
          <KpiCardSkeleton />
        </MarketHeader>
      </Section>

      <Section title="Chart cards">
        <div className="grid gap-4">
          <ChartCard
            demo
            title="Is the price high or low over the last ten years?"
            takeaway="Takeaway sentence, computed from the data by explicit rules. The break in the line is a data gap."
            method={DEMO_METHOD}
            info={DEMO_INFO}
            height={CHART_HEIGHT}
          >
            <TimeSeriesChart
              name="Synthetic series"
              commodity="crude"
              data={DAILY}
              unit="$/bbl"
              decimals={2}
              height={CHART_HEIGHT}
              ariaLabel="Synthetic daily price series over ten years, with a one-month gap"
            />
          </ChartCard>

          <ChartCard
            demo
            title="Are stocks tight for the season?"
            takeaway="Takeaway sentence: where this year sits against the 5-year range."
            method={DEMO_METHOD}
            info={{
              ...DEMO_INFO,
              unit: "TWh",
              freshness: "delayed",
              lastObservation: "2026-10-22",
            }}
            height={CHART_HEIGHT}
          >
            <SeasonalChart
              commodity="natgas"
              {...SEASONAL}
              currentLabel="2026"
              rangeLabel="2021–2025"
              unit="TWh"
              decimals={1}
              height={CHART_HEIGHT}
              ariaLabel="Synthetic seasonal chart: five-year range, average and current year"
            />
          </ChartCard>

          <ChartCard
            demo
            title="Is the curve in backwardation?"
            takeaway="Unofficial futures data: derived indicators only."
            method={DEMO_METHOD}
            info={{ ...DEMO_INFO, unofficial: true, attribution: undefined }}
            height={CHART_HEIGHT}
          >
            <TimeSeriesChart
              name="Synthetic spread"
              commodity="products"
              data={DAILY.slice(-500)}
              unit="$/bbl"
              decimals={2}
              height={CHART_HEIGHT}
              ariaLabel="Synthetic spread series with unofficial data label"
            />
          </ChartCard>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard
              demo
              title="Loading state"
              method={DEMO_METHOD}
              info={DEMO_INFO}
              status="loading"
              height={160}
            />
            <ChartCard
              demo
              title="Empty state"
              method={DEMO_METHOD}
              info={DEMO_INFO}
              status="empty"
              height={160}
            />
            <ChartCard
              demo
              title="Error state"
              method={DEMO_METHOD}
              info={DEMO_INFO}
              status="error"
              height={160}
            />
            <ChartCard
              demo
              title="Stale state"
              takeaway="The chart still shows, with a visible warning."
              method={DEMO_METHOD}
              info={{ ...DEMO_INFO, freshness: "stale", lastObservation: "2026-10-01" }}
              height={160}
            >
              <TimeSeriesChart
                name="Synthetic series"
                commodity="power"
                data={DAILY.slice(-120)}
                unit="€/MWh"
                decimals={2}
                height={160}
                ariaLabel="Synthetic series flagged as stale"
              />
            </ChartCard>
          </div>
        </div>
      </Section>

      <Section title="States and notices">
        <DataGapNotice
          title="No free daily NBP price"
          reason="ICE NBP futures are licensed and not redistributed. Shown as a gap, never estimated."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-2">
              <DemoBanner className="w-fit" />
              <EmptyState description="Try a wider date range." />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2">
              <DemoBanner className="w-fit" />
              <ErrorState />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}
