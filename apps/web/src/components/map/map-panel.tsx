import Link from "next/link";

import { UnofficialDataLabel } from "@/components/data-labels";
import type { PageContext } from "@/lib/data/page-context";
import type { Snapshot } from "@/lib/data/snapshot";
import { displayUnit } from "@/lib/display-units";
import { formatChange, formatDate, formatNumber, formatPercentile } from "@/lib/format";
import { europeGeometry } from "@/lib/geo/geometry";
import { MARKERS } from "@/lib/geo/markers";
import { COUNTRY_CODES, countrySeries, type HomeState, homeHref, LAYERS } from "@/lib/home/layers";

/** Series shown for a selected country, per layer, and where to read more. */
function countryDetail(layer: HomeState["layer"], cc: string): { codes: string[]; href: string } {
  const main = countrySeries(layer, cc);
  switch (layer) {
    case "storage":
      return {
        codes: main ? [main, `agsi.${cc}.storage`] : [],
        href: "/markets/gas?tab=storage",
      };
    case "power":
      return {
        codes: main ? [main] : [],
        href: `/markets/power${cc === "fr" ? "?zone=fr" : cc === "gb" ? "?zone=gb" : ""}`,
      };
    case "diesel":
      return {
        codes: main ? [main, `ec_wob.${cc}.diesel.wo_tax`] : [],
        href: "/markets/products",
      };
  }
}

export interface Selection {
  title: string;
  codes: string[];
  href: string;
  note?: string;
  position?: string;
}

/** What `?focus=` points to: a country of the current layer or a marker of the current view. */
export function resolveSelection(state: HomeState): Selection | null {
  if (!state.focus) return null;
  const marker = MARKERS.find((m) => m.id === state.focus && m.view === state.view);
  if (marker) {
    return {
      title: marker.label,
      codes: [marker.series, marker.secondary].filter((c): c is string => Boolean(c)),
      href: marker.href,
      note: marker.note,
      position: marker.position,
    };
  }
  if (state.view !== "europe") return null;
  const id = Object.entries(COUNTRY_CODES).find(([, cc]) => cc === state.focus)?.[0];
  const name = europeGeometry().countries.find((c) => c.id === id)?.name;
  if (!id || !name) return null;
  const detail = countryDetail(state.layer, state.focus);
  const layer = LAYERS.find((l) => l.id === state.layer)?.label ?? "";
  return {
    title: `${name} — ${layer.toLowerCase()}`,
    ...detail,
    note: detail.codes.length === 0 ? "This layer has no data for this country." : undefined,
  };
}

function Row({ snapshot, ctx }: { snapshot: Snapshot; ctx: PageContext }) {
  const meta = ctx.series.get(snapshot.code);
  const { unit, factor } = displayUnit(meta?.unit ?? "");
  const decimals = unit === "€/L" ? 3 : unit === "%" ? 1 : 2;
  const change =
    snapshot.prevValue === null ? null : (snapshot.lastValue - snapshot.prevValue) * factor;
  return (
    <div className="space-y-1 border-t pt-3 first:border-t-0 first:pt-0">
      <p className="text-xs text-muted-foreground">{meta?.name ?? snapshot.code}</p>
      <p className="text-lg font-semibold tabular-nums">
        {formatNumber(snapshot.lastValue * factor, decimals)}{" "}
        <span className="text-sm font-normal text-text-secondary">{unit}</span>
      </p>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Date</dt>
        <dd className="text-right tabular-nums">{formatDate(snapshot.lastTs)}</dd>
        <dt className="text-muted-foreground">vs previous</dt>
        <dd className="text-right tabular-nums">{formatChange(change, decimals)}</dd>
        <dt className="text-muted-foreground">5-year percentile</dt>
        <dd className="text-right tabular-nums">{formatPercentile(snapshot.percentile5y)}</dd>
        <dt className="text-muted-foreground">vs {ctx.rangeLabel} avg</dt>
        <dd className="text-right tabular-nums">
          {snapshot.seasonalYears >= 3 ? `${formatChange(snapshot.seasonalDeviationPct, 1)}%` : "—"}
        </dd>
      </dl>
      {meta?.isUnofficial && <UnofficialDataLabel />}
    </div>
  );
}

/** Side panel for the selected country or marker. Rendered on the server from the URL. */
export function MapPanel({
  state,
  selection,
  snapshots,
  ctx,
}: {
  state: HomeState;
  selection: Selection;
  snapshots: Map<string, Snapshot>;
  ctx: PageContext;
}) {
  const rows = selection.codes
    .map((code) => snapshots.get(code))
    .filter((s): s is Snapshot => s !== undefined);
  return (
    <section aria-label={`Details: ${selection.title}`} className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base leading-snug font-medium">{selection.title}</h2>
        <Link
          href={homeHref(state, { focus: null })}
          scroll={false}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Close
        </Link>
      </div>
      {rows.length > 0
        ? rows.map((s) => <Row key={s.code} snapshot={s} ctx={ctx} />)
        : !selection.note && <p className="text-sm text-text-secondary">No data yet.</p>}
      {selection.note && <p className="text-sm text-text-secondary">{selection.note}</p>}
      <Link
        href={selection.href}
        className="inline-block text-sm text-primary underline-offset-2 hover:underline"
      >
        Open the market page →
      </Link>
      {selection.position && (
        <p className="text-xs text-muted-foreground">Map position: {selection.position}.</p>
      )}
    </section>
  );
}
