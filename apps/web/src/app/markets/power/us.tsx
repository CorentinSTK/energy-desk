import { LinesCard } from "@/components/markets/lines-card";
import { latest } from "@/lib/analytics";
import type { PageContext } from "@/lib/data/page-context";
import { latestLevelTakeaway } from "@/lib/takeaways";

const CHART_HEIGHT = 300;

const EIA930_CAVEAT =
  "EIA-930 data are reported hourly by the balancing authorities and summed by EIA over each day in US Eastern time; the latest two days are left out until they are complete. Values are revised after publication.";

const FUELS = [
  { code: "eia.us48.gen.ng", name: "Natural gas", colorIndex: 1 },
  { code: "eia.us48.gen.col", name: "Coal", colorIndex: 6 },
  { code: "eia.us48.gen.nuc", name: "Nuclear", colorIndex: 3 },
  { code: "eia.us48.gen.wnd", name: "Wind", colorIndex: 0 },
  { code: "eia.us48.gen.sun", name: "Solar", colorIndex: 5 },
  { code: "eia.us48.gen.wat", name: "Hydro", colorIndex: 2 },
];

/** US power as context: Lower 48 demand and generation by fuel (EIA-930). */
export function UsTab({ ctx }: { ctx: PageContext }) {
  return (
    <div className="grid gap-4">
      <LinesCard
        ctx={ctx}
        title="How much electricity does the US use?"
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              Daily electricity demand of the Lower 48 states, in terawatt-hours per day (TWh/d). US
              demand peaks twice a year: summer air conditioning and winter heating.
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>{EIA930_CAVEAT}</p>
          </>
        }
        source="EIA"
        lines={[{ code: "eia.us48_demand", name: "US Lower 48 demand", colorIndex: 0 }]}
        days={3 * 365}
        decimals={2}
        height={CHART_HEIGHT}
        ariaLabel="US Lower 48 daily electricity demand, three years"
        takeaway={([demand]) => {
          const d = latest(demand);
          return d ? latestLevelTakeaway("US Lower 48 demand", d.value, "TWh", 2, d.ts) : undefined;
        }}
      />
      <LinesCard
        ctx={ctx}
        title="What generates US electricity?"
        method={
          <>
            <p className="font-medium text-foreground">What it shows</p>
            <p>
              Daily net generation of the Lower 48 from its six largest sources, in TWh per day.
              Petroleum, geothermal, storage and other sources are not shown, so the lines do not
              add up to demand.
            </p>
            <p className="font-medium text-foreground">Caveats</p>
            <p>{EIA930_CAVEAT}</p>
          </>
        }
        source="EIA"
        lines={FUELS}
        days={365}
        decimals={2}
        height={CHART_HEIGHT}
        ariaLabel="US Lower 48 daily generation by fuel, one year"
      />
    </div>
  );
}
