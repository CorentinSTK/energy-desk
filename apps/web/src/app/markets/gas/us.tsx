import { LinesCard } from "@/components/markets/lines-card";
import { WeeklySeasonalCard } from "@/components/markets/weekly-seasonal-card";
import { latest } from "@/lib/analytics";
import type { PageContext } from "@/lib/data/page-context";
import { latestLevelTakeaway, monthlyTotalTakeaway } from "@/lib/takeaways";

const CHART_HEIGHT = 280;

/** US gas as context for Europe: storage, the Henry Hub price and LNG exports (EIA). */
export function UsTab({ ctx }: { ctx: PageContext }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WeeklySeasonalCard
        ctx={ctx}
        code="eia.us_gas_storage"
        title="Is US gas storage high or low for the season?"
        subject="US working gas in storage"
        commodity="natgas"
        decimals={0}
        height={CHART_HEIGHT}
        caveat="Lower 48 working gas, in billion cubic feet (Bcf), as EIA reports it: Friday stocks, published the next Thursday. US storage is not comparable in level with EU storage (TWh): only its position against its own seasonal range is."
      />
      <LinesCard
        ctx={ctx}
        title="Where is the Henry Hub price?"
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              Henry Hub (Louisiana) natural gas spot price, the US benchmark and the cost basis of
              US LNG cargoes, EIA daily series.
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>
              A spot price in $/MMBtu; it is not compared with European prices here, which on this
              site are a monthly benchmark and futures indicators.
            </p>
          </>
        }
        source="EIA"
        lines={[{ code: "eia.henry_hub_spot", name: "Henry Hub spot", colorIndex: 0 }]}
        days={3 * 365}
        decimals={2}
        height={CHART_HEIGHT}
        ariaLabel="Henry Hub natural gas spot price, daily, three years"
        takeaway={([hh]) => {
          const h = latest(hh);
          return h ? latestLevelTakeaway("Henry Hub", h.value, "$/MMBtu", 2, h.ts) : undefined;
        }}
      />
      <div className="lg:col-span-2">
        <LinesCard
          ctx={ctx}
          title="How much LNG is the US exporting?"
          method={
            <>
              <p className="font-medium text-foreground">What it shows</p>
              <p>
                US LNG exports per month, in billion cubic feet (Bcf). The US is the largest LNG
                exporter and the main supplier of Europe&apos;s LNG imports.
              </p>
              <p className="font-medium text-foreground">Caveats</p>
              <p>
                Monthly EIA data, published about three months after the month. Destinations are not
                broken down here.
              </p>
            </>
          }
          source="EIA"
          lines={[{ code: "eia.us_lng_exports", name: "US LNG exports", colorIndex: 0 }]}
          days={5 * 365}
          decimals={0}
          height={CHART_HEIGHT}
          ariaLabel="US LNG exports per month, five years"
          takeaway={([lng]) => {
            const l = latest(lng);
            return l ? monthlyTotalTakeaway("US LNG exports", l.value, "Bcf", 0, l.ts) : undefined;
          }}
        />
      </div>
    </div>
  );
}
