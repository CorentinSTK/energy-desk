/**
 * ECharts option builders: the shared chart grammar (BUILD_SPEC §8). Pure functions of tokens and
 * data, so they are unit-tested without a browser.
 *
 * Grammar: one y-axis, thin lines, recessive grid, crosshair tooltip with exact values and dates,
 * gaps shown as gaps (nulls are never connected or filled).
 */

import type { EChartsCoreOption } from "echarts/core";

import { formatDate, formatDateTime, formatNumber } from "@/lib/format";

import type { ChartTokens } from "./chart-tokens";

/** [ISO date, value]; null marks a missing observation. */
export type TimeSeriesPoint = [string, number | null];

export interface TimeSeriesInput {
  name: string;
  color: string;
  data: TimeSeriesPoint[];
  unit: string;
  decimals: number;
  /** Intraday data: the tooltip shows the time in this IANA zone (e.g. "Europe/Berlin"). */
  timeZone?: string;
}

export interface SeasonalInput {
  /** Period labels on the x-axis, e.g. "W1"…"W52", or days "2001-01-01"… with `dailyAxis`. */
  periods: string[];
  /** Periods are calendar days (YYYY-MM-DD): one axis label per month, day names in the tooltip. */
  dailyAxis?: boolean;
  /**
   * Periods are weeks, given as the Monday of the week (YYYY-MM-DD in 2001): one axis label per
   * month, on its first week, and "Week of …" in the tooltip.
   */
  weeklyAxis?: boolean;
  min: (number | null)[];
  max: (number | null)[];
  average: (number | null)[];
  current: (number | null)[];
  currentLabel: string;
  /** Years covered by the band and average, e.g. "2021–2025". */
  rangeLabel: string;
  color: string;
  unit: string;
  decimals: number;
  /** Fixed top of the y-axis, e.g. 100 for a percentage that cannot exceed it. */
  yMax?: number;
}

const LINE_WIDTH = 1.5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2001-03-01" → "1 Mar". */
export function dayLabel(isoDay: string): string {
  const [, month, day] = isoDay.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}
const FONT_SIZE = 11;

function baseOption(t: ChartTokens): EChartsCoreOption {
  return {
    animation: false,
    textStyle: { fontFamily: t.fontFamily, color: t.textSecondary, fontSize: FONT_SIZE },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: t.axis, width: 1 } },
      backgroundColor: t.surface,
      borderColor: t.border,
      textStyle: { color: t.text, fontFamily: t.fontFamily, fontSize: 12 },
    },
  };
}

function valueAxis(t: ChartTokens, decimals: number) {
  return {
    type: "value",
    scale: true,
    axisLabel: { color: t.axis, formatter: (v: number) => formatNumber(v, decimals) },
    splitLine: { lineStyle: { color: t.grid } },
  };
}

function categoryLikeAxis(t: ChartTokens) {
  return {
    axisLine: { lineStyle: { color: t.grid } },
    axisTick: { show: false },
    axisLabel: { color: t.axis },
    splitLine: { show: false },
  };
}

interface TooltipParam {
  axisValue?: string | number;
  seriesName?: string;
  value?: unknown;
  dataIndex: number;
  marker?: string;
}

function tooltipRow(marker: string, label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:16px">
    <span>${marker}${label}</span><b style="font-variant-numeric:tabular-nums">${value}</b></div>`;
}

export function timeSeriesOption(t: ChartTokens, s: TimeSeriesInput): EChartsCoreOption {
  const base = baseOption(t);
  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      formatter: (params: TooltipParam[]) => {
        const p = params[0];
        const [date, value] = s.data[p.dataIndex];
        const when = s.timeZone ? formatDateTime(date, s.timeZone) : formatDate(date);
        return `${when}${tooltipRow(p.marker ?? "", s.name, `${formatNumber(value, s.decimals)} ${s.unit}`)}`;
      },
    },
    xAxis: { type: "time", ...categoryLikeAxis(t) },
    yAxis: valueAxis(t, s.decimals),
    dataZoom: [{ type: "inside", throttle: 50 }],
    series: [
      {
        name: s.name,
        type: "line",
        data: s.data,
        showSymbol: false,
        connectNulls: false,
        sampling: "lttb",
        lineStyle: { width: LINE_WIDTH, color: s.color },
        itemStyle: { color: s.color },
      },
    ],
  };
}

/** Band height for the stacked min–max area; null where either bound is missing. */
export function bandHeights(min: (number | null)[], max: (number | null)[]): (number | null)[] {
  return min.map((lo, i) => {
    const hi = max[i];
    return lo === null || hi === null ? null : hi - lo;
  });
}

/**
 * Seasonal chart: 5-year min–max band, 5-year average, current year highlighted (BUILD_SPEC §8).
 * The band is drawn as two stacked series: an invisible base at the minimum, plus the max−min height.
 */
export function seasonalOption(t: ChartTokens, s: SeasonalInput): EChartsCoreOption {
  const base = baseOption(t);
  const fmt = (v: number | null) => `${formatNumber(v, s.decimals)} ${s.unit}`;
  const BAND_STACK = "band";

  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      formatter: (params: TooltipParam[]) => {
        const i = params[0].dataIndex;
        return [
          s.dailyAxis
            ? dayLabel(s.periods[i])
            : s.weeklyAxis
              ? `Week of ${dayLabel(s.periods[i])}`
              : s.periods[i],
          tooltipRow("", s.currentLabel, fmt(s.current[i])),
          tooltipRow("", `${s.rangeLabel} avg`, fmt(s.average[i])),
          tooltipRow("", `${s.rangeLabel} range`, `${fmt(s.min[i])} – ${fmt(s.max[i])}`),
        ].join("");
      },
    },
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 4,
      textStyle: { color: t.textSecondary },
      data: [s.currentLabel, `${s.rangeLabel} avg`, `${s.rangeLabel} range`],
    },
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: s.periods,
      boundaryGap: false,
      ...categoryLikeAxis(t),
      ...((s.dailyAxis || s.weeklyAxis) && {
        axisLabel: {
          color: t.axis,
          // One label per month, on its first day (or first week); on narrow screens labels that
          // would overlap are hidden, so a phone shows every other month instead of a run-together row.
          interval: (_index: number, value: string) =>
            s.weeklyAxis ? Number(value.slice(8, 10)) <= 7 : value.endsWith("-01"),
          hideOverlap: true,
          formatter: (value: string) => MONTHS[Number(value.slice(5, 7)) - 1],
        },
      }),
    },
    yAxis: { ...valueAxis(t, s.decimals), ...(s.yMax !== undefined && { max: s.yMax }) },
    series: [
      {
        name: "band-base",
        type: "line",
        data: s.min,
        stack: BAND_STACK,
        symbol: "none",
        lineStyle: { opacity: 0 },
        tooltip: { show: false },
      },
      {
        name: `${s.rangeLabel} range`,
        type: "line",
        data: bandHeights(s.min, s.max),
        stack: BAND_STACK,
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color: t.band },
        itemStyle: { color: t.band },
      },
      {
        name: `${s.rangeLabel} avg`,
        type: "line",
        data: s.average,
        symbol: "none",
        lineStyle: { width: 1, type: "dashed", color: t.average },
        itemStyle: { color: t.average },
      },
      {
        name: s.currentLabel,
        type: "line",
        data: s.current,
        symbol: "none",
        connectNulls: false,
        lineStyle: { width: 2, color: s.color },
        itemStyle: { color: s.color },
      },
    ],
  };
}

export interface MultiLineInput {
  /** `colorIndex` pins a palette colour (0-based), e.g. the same colour for a fuel in every zone. */
  series: { name: string; data: TimeSeriesPoint[]; colorIndex?: number }[];
  unit: string;
  decimals: number;
  /** Stack the series as areas. Only for distinct quantities whose sum means something. */
  stacked?: boolean;
}

/** Several series on one axis (same unit), categorical colours, legend on top. */
export function multiLineOption(t: ChartTokens, s: MultiLineInput): EChartsCoreOption {
  const base = baseOption(t);
  return {
    ...base,
    color: t.series,
    tooltip: {
      ...(base.tooltip as object),
      formatter: (params: TooltipParam[]) => {
        const first = params[0];
        const date = s.series[0]?.data[first.dataIndex]?.[0];
        const rows = params.map((p) => {
          const value = (p.value as [string, number | null] | undefined)?.[1] ?? null;
          return tooltipRow(
            p.marker ?? "",
            p.seriesName ?? "",
            `${formatNumber(value, s.decimals)} ${s.unit}`,
          );
        });
        return `${formatDate(typeof first.axisValue === "number" ? new Date(first.axisValue) : (date ?? null))}${rows.join("")}`;
      },
    },
    legend: {
      top: 0,
      type: "scroll",
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 4,
      textStyle: { color: t.textSecondary },
    },
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    xAxis: { type: "time", ...categoryLikeAxis(t) },
    yAxis: valueAxis(t, s.decimals),
    dataZoom: [{ type: "inside", throttle: 50 }],
    series: s.series.map((line) => ({
      name: line.name,
      type: "line",
      data: line.data,
      showSymbol: false,
      connectNulls: false,
      sampling: "lttb",
      ...(line.colorIndex !== undefined && {
        itemStyle: { color: t.series[line.colorIndex % t.series.length] },
      }),
      lineStyle: {
        width: s.stacked ? 0.5 : LINE_WIDTH,
        ...(line.colorIndex !== undefined && {
          color: t.series[line.colorIndex % t.series.length],
        }),
      },
      ...(s.stacked && {
        stack: "total",
        areaStyle: {
          opacity: 0.85,
          ...(line.colorIndex !== undefined && {
            color: t.series[line.colorIndex % t.series.length],
          }),
        },
      }),
    })),
  };
}

export interface BarInput {
  /** Category labels, drawn top to bottom. */
  categories: string[];
  /** One value per category; null leaves the bar out (no data), never zero. */
  series: { name: string; values: (number | null)[]; colorIndex?: number }[];
  unit: string;
  decimals: number;
  /** Stack the series: only for parts that add up (e.g. price before taxes + taxes). */
  stacked?: boolean;
}

/** Horizontal bars for comparing categories (e.g. countries) on one date. */
export function barOption(t: ChartTokens, s: BarInput): EChartsCoreOption {
  const base = baseOption(t);
  const fmt = (v: number | null) => `${formatNumber(v, s.decimals)} ${s.unit}`;
  return {
    ...base,
    color: t.series,
    tooltip: {
      ...(base.tooltip as object),
      axisPointer: { type: "shadow" },
      formatter: (params: TooltipParam[]) => {
        const i = params[0].dataIndex;
        const rows = s.series.map((line, k) =>
          tooltipRow(params[k]?.marker ?? "", line.name, fmt(line.values[i])),
        );
        const parts = s.series.map((line) => line.values[i]);
        const total =
          s.stacked && parts.every((v) => v !== null)
            ? tooltipRow("", "Total", fmt(parts.reduce<number>((sum, v) => sum + (v ?? 0), 0)))
            : "";
        return `${s.categories[i]}${rows.join("")}${total}`;
      },
    },
    legend: {
      top: 0,
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 4,
      textStyle: { color: t.textSecondary },
    },
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: (() => {
      const axis = valueAxis(t, s.decimals);
      // Start at zero (bars are lengths) and drop labels that would overlap on a phone.
      return { ...axis, scale: false, axisLabel: { ...axis.axisLabel, hideOverlap: true } };
    })(),
    yAxis: { type: "category", data: s.categories, inverse: true, ...categoryLikeAxis(t) },
    series: s.series.map((line) => ({
      name: line.name,
      type: "bar",
      data: line.values,
      barMaxWidth: 14,
      ...(s.stacked && { stack: "total" }),
      ...(line.colorIndex !== undefined && {
        itemStyle: { color: t.series[line.colorIndex % t.series.length] },
      }),
    })),
  };
}

export interface CurveInput {
  /** Tenor labels on the x-axis, e.g. "M1"…"M12". */
  tenors: string[];
  /** One line per date (e.g. latest, a week earlier, a month earlier); null = no value. */
  series: { name: string; values: (number | null)[]; colorIndex?: number }[];
  unit: string;
  decimals: number;
}

/** Futures curve shape: value by tenor, one line per date. Gaps are not connected. */
export function curveOption(t: ChartTokens, s: CurveInput): EChartsCoreOption {
  const base = baseOption(t);
  return {
    ...base,
    color: t.series,
    tooltip: {
      ...(base.tooltip as object),
      formatter: (params: TooltipParam[]) => {
        const i = params[0].dataIndex;
        const rows = s.series.map((line, k) =>
          tooltipRow(
            params[k]?.marker ?? "",
            line.name,
            `${formatNumber(line.values[i], s.decimals)} ${s.unit}`,
          ),
        );
        return `${s.tenors[i]}${rows.join("")}`;
      },
    },
    legend: {
      top: 0,
      icon: "roundRect",
      itemWidth: 12,
      itemHeight: 4,
      textStyle: { color: t.textSecondary },
    },
    grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: s.tenors, boundaryGap: false, ...categoryLikeAxis(t) },
    yAxis: valueAxis(t, s.decimals),
    series: s.series.map((line, k) => ({
      name: line.name,
      type: "line",
      data: line.values,
      connectNulls: false,
      symbol: "circle",
      symbolSize: 4,
      lineStyle: { width: k === 0 ? 2 : LINE_WIDTH, ...(k > 0 && { type: "dashed" }) },
      ...(line.colorIndex !== undefined && {
        itemStyle: { color: t.series[line.colorIndex % t.series.length] },
      }),
    })),
  };
}

export interface HistogramInput {
  /** Bin labels on the x-axis, low to high. */
  labels: string[];
  counts: number[];
  /** Bins whose values are losses (drawn in the second palette colour). */
  negative: boolean[];
  /** What a count means, for the tooltip, e.g. "paths". */
  countLabel: string;
}

/** Vertical bars of a distribution (e.g. simulated P&L), losses and gains in two colours. */
export function histogramOption(t: ChartTokens, s: HistogramInput): EChartsCoreOption {
  const base = baseOption(t);
  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      axisPointer: { type: "shadow" },
      formatter: (params: TooltipParam[]) => {
        const i = params[0].dataIndex;
        return `${s.labels[i]}${tooltipRow("", s.countLabel, formatNumber(s.counts[i], 0))}`;
      },
    },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: s.labels,
      ...categoryLikeAxis(t),
      axisLabel: { color: t.axis, hideOverlap: true },
    },
    yAxis: { ...valueAxis(t, 0), scale: false },
    series: [
      {
        type: "bar",
        barCategoryGap: "10%",
        data: s.counts.map((count, i) => ({
          value: count,
          itemStyle: { color: s.negative[i] ? t.series[1] : t.series[0] },
        })),
      },
    ],
  };
}
