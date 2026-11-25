import { ChartCard } from "@/components/chart-card";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, daysAgo, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPointsMany } from "@/lib/data/series";
import { formatDate, formatNumber } from "@/lib/format";
import { BORDERS, direction, trailingMean } from "@/lib/power/flows";

const WINDOW_DAYS = 7;
const CODES = BORDERS.map((b) => b.code);

const METHOD = (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>
      The average net physical flow across each border over the last {WINDOW_DAYS} published days,
      in MW: the flow one way minus the flow the other way, hour by hour, averaged per day. The bar
      points to the importing side.
    </p>
    <p className="font-medium text-foreground">How to read it</p>
    <p>
      Power flows from cheaper to dearer zones until the border is full; compare with the zone price
      gaps above. Physical flows follow the grid, so they can differ from the commercial exchanges
      agreed in the auction (loop flows).
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      A border shows no value unless all {WINDOW_DAYS} days are published. Days are Europe/Brussels
      days. Daily averages are computed by Energy Desk from ENTSO-E&apos;s hourly or quarter-hourly
      values.
    </p>
  </>
);

export async function CrossBorderFlows({ ctx }: { ctx: PageContext }) {
  const loaded = await attempt("cross-border flows", getPointsMany(CODES, daysAgo(ctx.now, 21)));
  const rows = BORDERS.map((border) => {
    const m = loaded ? trailingMean(loaded.get(border.code) ?? [], WINDOW_DAYS) : null;
    return { border, mean: m?.mean ?? null, asOf: m?.asOf ?? null };
  });
  const shown = rows.filter((r) => r.mean !== null);
  const scale = Math.max(1, ...shown.map((r) => Math.abs(r.mean ?? 0)));
  const biggest = shown.length
    ? shown.reduce((a, b) => (Math.abs(b.mean ?? 0) > Math.abs(a.mean ?? 0) ? b : a))
    : null;
  const asOf =
    shown
      .map((r) => r.asOf)
      .sort()
      .at(-1) ?? null;

  return (
    <ChartCard
      title="Which way is power flowing?"
      takeaway={
        biggest && biggest.mean !== null && asOf
          ? (() => {
              const d = direction(biggest.border, biggest.mean);
              return `In the ${WINDOW_DAYS} days to ${formatDate(asOf)}, the largest net flow was ${d.exporter} to ${d.importer}, ${formatNumber(Math.abs(biggest.mean), 0)} MW on average.`;
            })()
          : undefined
      }
      method={METHOD}
      info={chartInfo(seriesOf(ctx, ...CODES), ctx.extractionDates, ctx.now, {
        source: "ENTSO-E",
        unit: "MW",
      })}
      status={loaded === null ? "error" : shown.length === 0 ? "empty" : "ready"}
      height={0}
    >
      <ul className="space-y-1.5" aria-label={`Net physical flows, ${WINDOW_DAYS}-day average, MW`}>
        {rows.map(({ border, mean }) => {
          const d = mean === null ? null : direction(border, mean);
          const width = mean === null ? 0 : (Math.abs(mean) / scale) * 50;
          return (
            <li
              key={border.code}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_7rem]"
            >
              <span className="truncate text-right text-text-secondary">{border.from}</span>
              {/* Diverging bar: to the right when the left zone exports, to the left otherwise. */}
              <span className="relative h-5 rounded bg-muted/60" aria-hidden>
                <span className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
                {mean !== null && (
                  <span
                    className="absolute inset-y-1 rounded-sm bg-power"
                    style={
                      mean >= 0
                        ? { left: "50%", width: `${width}%` }
                        : { right: "50%", width: `${width}%` }
                    }
                  />
                )}
              </span>
              <span className="truncate text-text-secondary">{border.to}</span>
              <span className="col-span-3 -mt-1 text-center font-mono text-[11px] text-muted-foreground tabular-nums">
                {d && mean !== null
                  ? `${d.exporter} → ${d.importer} ${formatNumber(Math.abs(mean), 0)} MW`
                  : "not published for every day"}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
