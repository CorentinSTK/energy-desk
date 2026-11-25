import { ChartCard } from "@/components/chart-card";
import { MultiLineChart } from "@/components/charts/multi-line-chart";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPointsMany, type Points } from "@/lib/data/series";
import { formatChange, formatDate, formatNumber } from "@/lib/format";

import { EUROPEAN_ZONES } from "./data";

const CHART_HEIGHT = 300;
const CHART_DAYS = 90;
const AVERAGE_DAYS = 30;
const UNIT = "€/MWh";
const CODES = EUROPEAN_ZONES.map((z) => z.code);

const METHOD = (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>
      Daily base prices (average of the hourly day-ahead prices over the delivery day,
      Europe/Berlin) for eight bidding zones, all from the same coupled European auction (SDAC). The
      table compares zones on one delivery day: the latest day Germany-Luxembourg is published.
    </p>
    <p className="font-medium text-foreground">How to read it</p>
    <p>
      Zones with the same price were coupled that day: interconnectors had spare capacity. A gap
      between two zones means the flow between them hit its limit. The spread is the zone minus
      Germany-Luxembourg, both spot prices in €/MWh.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      SMARD publishes the neighbouring zones as received from ENTSO-E; a day it did not publish is
      shown as not published, never filled in. The 30-day average uses the days published in the
      last 30 days.
    </p>
  </>
);

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** The zone's value on `day`, if published. */
function onDay(points: Points | undefined, day: string): number | null {
  return points?.find(([ts]) => ts === day)?.[1] ?? null;
}

export async function EuropeanZones({ ctx }: { ctx: PageContext }) {
  const loaded = await attempt(
    "European zone prices",
    getPointsMany(CODES, daysAgo(ctx.now, CHART_DAYS)),
  );
  const info = chartInfo(seriesOf(ctx, ...CODES), ctx.extractionDates, ctx.now, {
    source: "SMARD",
    unit: UNIT,
  });
  const de = loaded?.get(EUROPEAN_ZONES[0].code);
  const day = de?.at(-1)?.[0] ?? null;
  const deValue = day ? onDay(de, day) : null;
  const averageFrom = daysAgo(ctx.now, AVERAGE_DAYS);
  const rows = EUROPEAN_ZONES.map((z) => {
    const points = loaded?.get(z.code);
    const value = day ? onDay(points, day) : null;
    return {
      zone: z,
      value,
      spread: value !== null && deValue !== null ? value - deValue : null,
      average: mean((points ?? []).filter(([ts]) => ts >= averageFrom).map(([, v]) => v)),
    };
  });
  const published = rows.filter((r) => r.value !== null);
  const dearest = published.length
    ? published.reduce((a, b) => ((b.value ?? 0) > (a.value ?? 0) ? b : a))
    : null;
  const cheapest = published.length
    ? published.reduce((a, b) => ((b.value ?? 0) < (a.value ?? 0) ? b : a))
    : null;
  const empty = !loaded || CODES.every((c) => (loaded.get(c)?.length ?? 0) === 0);

  return (
    <div className="grid gap-4">
      <ChartCard
        title="How do day-ahead prices compare across Europe?"
        takeaway={
          day && dearest && cheapest && dearest !== cheapest
            ? `On ${formatDate(day)}, base power was dearest in ${dearest.zone.label} (${formatNumber(dearest.value, 0)} ${UNIT}) and cheapest in ${cheapest.zone.label} (${formatNumber(cheapest.value, 0)} ${UNIT}).`
            : undefined
        }
        method={METHOD}
        info={info}
        status={loaded === null ? "error" : empty ? "empty" : "ready"}
        height={CHART_HEIGHT}
      >
        {loaded && (
          <MultiLineChart
            series={EUROPEAN_ZONES.map((z) => ({
              name: z.label,
              data: loaded.get(z.code) ?? [],
              colorIndex: z.colorIndex,
            }))}
            unit={UNIT}
            decimals={0}
            height={CHART_HEIGHT}
            ariaLabel={`Day-ahead base prices in eight European zones over the last ${CHART_DAYS} days`}
          />
        )}
      </ChartCard>

      {loaded && day && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">
              Day-ahead base prices by zone on {formatDate(day)}, spread to Germany-Luxembourg and
              30-day average
            </caption>
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Zone</th>
                <th className="px-3 py-2 text-right font-medium">
                  Base, {formatDate(day)} ({UNIT})
                </th>
                <th className="px-3 py-2 text-right font-medium">vs DE-LU ({UNIT})</th>
                <th className="px-3 py-2 text-right font-medium">
                  {AVERAGE_DAYS}-day average ({UNIT})
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.zone.code}>
                  <td className="px-3 py-2">{r.zone.label}</td>
                  <td className="px-3 py-2 text-right">
                    {r.value === null ? (
                      <span className="text-muted-foreground">not published</span>
                    ) : (
                      formatNumber(r.value, 2)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.zone.short === "DE-LU" || r.spread === null
                      ? "—"
                      : formatChange(r.spread, 2)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(r.average, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
