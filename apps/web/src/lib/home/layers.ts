/**
 * Home page map: what colours the map (layer), how it is measured (metric), and the colour scales.
 * Pure functions, unit-tested. Thresholds are named constants (BUILD_SPEC §2.3).
 */

import type { Snapshot } from "@/lib/data/snapshot";
import { formatChange, formatPercentile } from "@/lib/format";

export const VIEWS = [
  { id: "europe", label: "Europe" },
  { id: "world", label: "World (oil)" },
] as const;
export type View = (typeof VIEWS)[number]["id"];

/** What the country shapes show in the Europe view. */
export const LAYERS = [
  { id: "storage", label: "Gas storage" },
  { id: "power", label: "Power prices" },
  { id: "diesel", label: "Diesel at the pump" },
] as const;
export type Layer = (typeof LAYERS)[number]["id"];

export const METRICS = [
  { id: "seasonal", label: "vs 5-year average" },
  { id: "move", label: "Latest move" },
  { id: "percentile", label: "5-year percentile" },
] as const;
export type Metric = (typeof METRICS)[number]["id"];

export interface HomeState {
  view: View;
  layer: Layer;
  metric: Metric;
  /** Id of the selected country or marker, shown in the side panel. */
  focus: string | null;
}

const FOCUS_PATTERN = /^[a-z0-9-]{1,40}$/;

/** URL parameters, checked against allow-lists (unknown values fall back to defaults). */
export function parseHomeParams(params: Record<string, string | string[] | undefined>): HomeState {
  const focus = typeof params.focus === "string" ? params.focus : null;
  return {
    view: VIEWS.find((v) => v.id === params.view)?.id ?? "europe",
    layer: LAYERS.find((l) => l.id === params.layer)?.id ?? "storage",
    metric: METRICS.find((m) => m.id === params.metric)?.id ?? "seasonal",
    focus: focus && FOCUS_PATTERN.test(focus) ? focus : null,
  };
}

export function homeHref(state: HomeState, change: Partial<HomeState> = {}): string {
  const next = { ...state, ...change };
  const query = new URLSearchParams();
  if (next.view !== "europe") query.set("view", next.view);
  if (next.layer !== "storage") query.set("layer", next.layer);
  if (next.metric !== "seasonal") query.set("metric", next.metric);
  if (next.focus) query.set("focus", next.focus);
  const text = query.toString();
  return text ? `/?${text}` : "/";
}

// Countries ----------------------------------------------------------------------------------------

/** world-atlas (ISO 3166-1 numeric) → our two-letter code, for the countries any layer covers. */
export const COUNTRY_CODES: Record<string, string> = {
  "040": "at",
  "056": "be",
  "100": "bg",
  "191": "hr",
  "196": "cy",
  "203": "cz",
  "208": "dk",
  "233": "ee",
  "246": "fi",
  "250": "fr",
  "276": "de",
  "300": "gr",
  "348": "hu",
  "372": "ie",
  "380": "it",
  "428": "lv",
  "440": "lt",
  "442": "lu",
  "470": "mt",
  "528": "nl",
  "616": "pl",
  "620": "pt",
  "642": "ro",
  "703": "sk",
  "705": "si",
  "724": "es",
  "752": "se",
  "826": "gb",
};

/** EU countries with storage data in AGSI+ (worker/catalog/gie_agsi.yaml). */
const STORAGE_COUNTRIES = new Set([
  "at",
  "be",
  "bg",
  "cz",
  "de",
  "dk",
  "es",
  "fr",
  "hr",
  "hu",
  "it",
  "lv",
  "nl",
  "pl",
  "pt",
  "ro",
  "se",
  "sk",
]);

/** Bidding zones: Luxembourg is part of the DE-LU zone; GB is the Elexon market index. */
const POWER_SERIES: Record<string, string> = {
  de: "smard.de_lu.price_da_base",
  lu: "smard.de_lu.price_da_base",
  fr: "smard.fr.price_da_base",
  gb: "elexon.gb.mid_base",
};

/** Main series of a country for a layer, or null when the layer does not cover it. */
export function countrySeries(layer: Layer, cc: string): string | null {
  switch (layer) {
    case "storage":
      return STORAGE_COUNTRIES.has(cc) ? `agsi.${cc}.full` : null;
    case "power":
      return POWER_SERIES[cc] ?? null;
    case "diesel":
      return cc === "gb" ? null : `ec_wob.${cc}.diesel.with_tax`;
  }
}

/** Every series a layer can use, for one snapshot query. */
export function layerSeries(layer: Layer): string[] {
  return [
    ...new Set(
      Object.values(COUNTRY_CODES)
        .map((cc) => countrySeries(layer, cc))
        .filter((code): code is string => code !== null),
    ),
  ];
}

// Metrics and colour ----------------------------------------------------------------------------

/** A seasonal norm needs at least this many prior years to be shown. */
export const MIN_SEASONAL_YEARS = 3;
/** Bin edges for the distance from the five-year average, in % of the average. */
export const SEASONAL_BINS = [5, 15, 30];
/** Bin edges for the latest move, in standard deviations of the past year's moves. */
export const MOVE_BINS = [1, 2, 3];
/** Bin edges for the five-year percentile. */
export const PERCENTILE_BINS = [20, 40, 60, 80];

/** The value a metric gives a series, or null when there is not enough data. */
export function metricValue(snapshot: Snapshot | undefined, metric: Metric): number | null {
  if (!snapshot) return null;
  switch (metric) {
    case "seasonal":
      return snapshot.seasonalYears >= MIN_SEASONAL_YEARS ? snapshot.seasonalDeviationPct : null;
    case "move":
      return snapshot.moveZ;
    case "percentile":
      return snapshot.percentile5y;
  }
}

/** CSS variable of the colour for a value; "no data" when the value is null. */
export function colorFor(metric: Metric, value: number | null): string {
  if (value === null) return "var(--map-nodata)";
  if (metric === "percentile") {
    const bin = PERCENTILE_BINS.filter((edge) => value >= edge).length;
    return `var(--map-seq-${bin + 1})`;
  }
  const edges = metric === "seasonal" ? SEASONAL_BINS : MOVE_BINS;
  // 0: within the first edge; 1–3: beyond each further edge, signed.
  const step =
    Math.abs(value) < edges[0] ? 0 : edges.filter((edge) => Math.abs(value) >= edge).length;
  if (step === 0) return "var(--map-div-0)";
  return `var(--map-div-${value < 0 ? "n" : "p"}${step})`;
}

export interface LegendItem {
  color: string;
  label: string;
}

/** Legend entries, low to high, with "No data" last. */
export function legend(metric: Metric): LegendItem[] {
  const noData = { color: "var(--map-nodata)", label: "No data" };
  if (metric === "percentile") {
    const edges = [0, ...PERCENTILE_BINS, 100];
    return [
      ...edges.slice(0, -1).map((low, i) => ({
        color: `var(--map-seq-${i + 1})`,
        label: `${low}–${edges[i + 1]}`,
      })),
      noData,
    ];
  }
  const edges = metric === "seasonal" ? SEASONAL_BINS : MOVE_BINS;
  const unit = metric === "seasonal" ? "%" : "σ";
  const [a, b, c] = edges;
  return [
    { color: "var(--map-div-n3)", label: `< −${c}${unit}` },
    { color: "var(--map-div-n2)", label: `−${c} to −${b}${unit}` },
    { color: "var(--map-div-n1)", label: `−${b} to −${a}${unit}` },
    { color: "var(--map-div-0)", label: `±${a}${unit}` },
    { color: "var(--map-div-p1)", label: `${a} to ${b}${unit}` },
    { color: "var(--map-div-p2)", label: `${b} to ${c}${unit}` },
    { color: "var(--map-div-p3)", label: `> ${c}${unit}` },
    noData,
  ];
}

/** The metric value in words, for tooltips and the data table. */
export function metricText(metric: Metric, value: number | null): string {
  if (value === null) return "no data";
  switch (metric) {
    case "seasonal":
      return `${formatChange(value, 1)}% vs 5-year average`;
    case "move":
      return `${formatChange(value, 1)}σ latest move`;
    case "percentile":
      return `${formatPercentile(value)} of 5 years`;
  }
}
