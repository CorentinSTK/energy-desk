import { ChartCard } from "@/components/chart-card";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPointsMany } from "@/lib/data/series";
import { formatNumber } from "@/lib/format";
import { couplingMatrix, GAP_EDGES, gapBin } from "@/lib/power/coupling";
import { cn } from "@/lib/utils";

import { EUROPEAN_ZONES } from "./data";

const WINDOW_DAYS = 30;
/** Hourly day-ahead prices of the zones, next to their daily base series in the catalogue. */
const HOURLY = EUROPEAN_ZONES.map((z) => z.code.replace(/_base$/, ""));
/** Legend, closest first (bin 5 … 1). */
const BINS = [
  `< ${GAP_EDGES[0]}`,
  ...GAP_EDGES.slice(1).map((edge, k) => `${GAP_EDGES[k]}–${edge}`),
  `≥ ${GAP_EDGES.at(-1)}`,
];

const METHOD = (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>
      For each pair of zones, the mean absolute gap between their hourly day-ahead prices over the
      last {WINDOW_DAYS} days, in €/MWh, from SMARD&apos;s hourly prices (all spot, same auction).
      All eight zones clear in the single European day-ahead auction (SDAC): when the borders
      between two zones are not congested they get the same price, and congestion opens a gap.
    </p>
    <p className="font-medium text-foreground">How to read it</p>
    <p>
      Strongly coloured cells: zones that trade close together, well connected. Faint cells: zones
      often split by congestion; the gap is roughly what one more megawatt of transmission between
      them would have been worth. Hover a cell for the number of common hours and the share of hours
      with exactly the same price.
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      Only hours published for both zones count; missing hours are left out, never filled. Since the
      auction moved to 15-minute products (October 2025), SMARD&apos;s hourly value averages four
      prices, so exactly equal hourly prices are rare even between coupled zones: the gap is the
      main measure. A mean gap hides direction: which zone was dearer is in the table above.
    </p>
  </>
);

export async function CouplingMatrix({ ctx }: { ctx: PageContext }) {
  const loaded = await attempt(
    "zone coupling",
    getPointsMany(HOURLY, daysAgo(ctx.now, WINDOW_DAYS)),
  );
  const info = {
    ...chartInfo(seriesOf(ctx, ...HOURLY), ctx.extractionDates, ctx.now, {
      source: "SMARD",
      unit: "€/MWh",
    }),
    // Cells show a mean absolute gap between two prices, not a price.
    unit: "€/MWh, mean absolute hourly gap",
  };
  const matrix = loaded ? couplingMatrix(HOURLY.map((c) => loaded.get(c) ?? [])) : null;
  const pairs = matrix
    ? matrix.flatMap((row, i) =>
        row.flatMap((cell, j) =>
          j < i && cell?.meanAbsSpread != null ? [{ i, j, gap: cell.meanAbsSpread }] : [],
        ),
      )
    : [];
  const closest = pairs.length ? pairs.reduce((a, b) => (b.gap < a.gap ? b : a)) : null;
  const furthest = pairs.length ? pairs.reduce((a, b) => (b.gap > a.gap ? b : a)) : null;
  const name = (k: number) => EUROPEAN_ZONES[k].short;
  const pct = (v: number) => `${formatNumber(v * 100, 0)}%`;

  return (
    <ChartCard
      title="Which zones trade close together?"
      takeaway={
        closest && furthest && closest !== furthest
          ? `In the last ${WINDOW_DAYS} days, ${name(closest.i)} and ${name(closest.j)} were closest (${formatNumber(closest.gap, 1)} €/MWh apart on average, hour by hour); ${name(furthest.i)} and ${name(furthest.j)} furthest apart (${formatNumber(furthest.gap, 1)} €/MWh).`
          : undefined
      }
      method={METHOD}
      info={info}
      status={matrix === null ? "error" : pairs.length === 0 ? "empty" : "ready"}
      height={0}
    >
      {matrix && (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="mx-auto border-separate border-spacing-1 text-xs">
              <caption className="sr-only">
                Mean absolute gap between hourly day-ahead prices, by pair of zones, last{" "}
                {WINDOW_DAYS} days, €/MWh
              </caption>
              <thead>
                <tr>
                  <th />
                  {EUROPEAN_ZONES.slice(0, -1).map((z) => (
                    <th
                      key={z.code}
                      scope="col"
                      className="px-1 pb-1 font-medium whitespace-nowrap text-muted-foreground"
                    >
                      {z.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EUROPEAN_ZONES.map((row, i) =>
                  i === 0 ? null : (
                    <tr key={row.code}>
                      <th
                        scope="row"
                        className="pr-2 text-right font-medium whitespace-nowrap text-muted-foreground"
                      >
                        {row.short}
                      </th>
                      {EUROPEAN_ZONES.slice(0, -1).map((col, j) => {
                        if (j >= i) return <td key={col.code} />;
                        const cell = matrix[i][j];
                        const gap = cell?.meanAbsSpread ?? null;
                        const label =
                          gap === null || !cell
                            ? `${row.short}–${col.short}: no common hours`
                            : `${row.short}–${col.short}: mean gap ${formatNumber(gap, 1)} €/MWh over ${cell.hours} common hours; exactly the same price in ${pct(cell.sameShare ?? 0)} of them`;
                        return (
                          <td key={col.code} title={label} aria-label={label} className="p-0">
                            <div
                              className={cn(
                                "flex h-10 w-12 items-center justify-center rounded-md sm:w-14",
                                gap === null && "border border-dashed",
                              )}
                              style={
                                gap === null
                                  ? undefined
                                  : { background: `var(--map-seq-${gapBin(gap)})` }
                              }
                            >
                              <span className="rounded bg-background/85 px-1 font-mono text-[11px] tabular-nums">
                                {gap === null ? "—" : formatNumber(gap, 0)}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <li>Mean gap, €/MWh:</li>
            {BINS.map((label, k) => (
              <li key={label} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm ring-1 ring-border"
                  style={{ background: `var(--map-seq-${5 - k})` }}
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
