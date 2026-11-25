import { ChartCard } from "@/components/chart-card";
import { chartInfo } from "@/lib/data/chart-info";
import { attempt, type PageContext, seriesOf } from "@/lib/data/page-context";
import { getPointsMany } from "@/lib/data/series";
import { formatDate, formatNumber } from "@/lib/format";
import { TARGET_PCT, targetWindow, windowResult } from "@/lib/gas/storage-target";
import { layerSeries } from "@/lib/home/layers";
import { cn } from "@/lib/utils";

const EU = "agsi.eu.full";

const METHOD = (
  <>
    <p className="font-medium text-foreground">What it shows</p>
    <p>
      For the EU and each country with storage, the highest filling level published between 1
      October and 1 December (or today, while the window is open), and the first day it reached{" "}
      {TARGET_PCT}%. Filling levels from GIE AGSI+.
    </p>
    <p className="font-medium text-foreground">The rule</p>
    <p>
      Under the EU gas storage rules as extended for 2025–2027 (Regulation (EU) 2025/1733), storage
      should reach {TARGET_PCT}% at any time between 1 October and 1 December, instead of by 1
      November. Countries may deviate in difficult market conditions or under technical constraints,
      and the European Commission may lower the target (European Commission, gas storage page).
    </p>
    <p className="font-medium text-foreground">Caveats</p>
    <p>
      This is a measure against {TARGET_PCT}%, not a compliance check: allowed deviations and
      national obligations cannot be read from filling data. Days not published are left out.
    </p>
  </>
);

export async function StorageTargetCard({ ctx }: { ctx: PageContext }) {
  const window = targetWindow(ctx.now);
  const codes = [EU, ...layerSeries("storage").filter((c) => c !== EU)];
  const loaded = await attempt("storage target window", getPointsMany(codes, window.start));
  const rows = codes
    .map((code) => ({
      code,
      label: code === EU ? "EU" : (ctx.series.get(code)?.region ?? code),
      result: loaded ? windowResult(loaded.get(code) ?? [], window) : null,
    }))
    .filter((r) => r.result !== null)
    .sort((a, b) =>
      a.code === EU ? -1 : b.code === EU ? 1 : (b.result?.peak ?? 0) - (a.result?.peak ?? 0),
    );
  const countries = rows.filter((r) => r.code !== EU);
  const reached = countries.filter((r) => r.result?.reachedOn).length;
  const eu = rows.find((r) => r.code === EU)?.result;
  const year = window.start.slice(0, 4);

  return (
    <ChartCard
      title={`Did storage reach ${TARGET_PCT}% in the ${year} filling window?`}
      takeaway={
        eu
          ? `EU storage peaked at ${formatNumber(eu.peak, 1)}% on ${formatDate(eu.peakDate)}${
              eu.reachedOn ? `, at or above ${TARGET_PCT}% from ${formatDate(eu.reachedOn)}` : ""
            }; ${reached} of ${countries.length} countries reached ${TARGET_PCT}% ${
              window.open ? "so far (the window runs to 1 December)" : "in the window"
            }.`
          : undefined
      }
      method={METHOD}
      info={chartInfo(seriesOf(ctx, ...codes), ctx.extractionDates, ctx.now, {
        source: "GIE AGSI+",
        unit: "%",
      })}
      status={loaded === null ? "error" : rows.length === 0 ? "empty" : "ready"}
      height={0}
    >
      <ul
        className="space-y-1.5"
        aria-label={`Peak filling level, 1 October to 1 December ${year}`}
      >
        {rows.map(({ code, label, result }) => {
          if (!result) return null;
          const hit = result.reachedOn !== null;
          return (
            <li
              key={code}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_4rem_9rem]"
            >
              <span className={cn("truncate", code === EU && "font-semibold")}>{label}</span>
              {/* Bar to 100 %, with the target drawn as a line at 90 %. */}
              <span className="relative h-2.5 rounded-full bg-muted" aria-hidden>
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    hit ? "bg-natgas" : "bg-natgas/45",
                  )}
                  style={{ width: `${Math.min(100, result.peak)}%` }}
                />
                <span
                  className="absolute -inset-y-1 w-px bg-foreground/70"
                  style={{ left: `${TARGET_PCT}%` }}
                />
              </span>
              <span className="text-right font-mono text-xs tabular-nums">
                {formatNumber(result.peak, 1)}%
              </span>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {hit
                  ? `≥ ${TARGET_PCT}% from ${formatDate(result.reachedOn)}`
                  : `below ${TARGET_PCT}%${window.open ? " so far" : ""}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Peak level in the window; the vertical line marks {TARGET_PCT}%. A measure, not a compliance
        check: countries may deviate under the rules.
      </p>
    </ChartCard>
  );
}
