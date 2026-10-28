/**
 * ECharts option builders: the shared chart grammar (BUILD_SPEC §8). Pure functions of tokens and
 * data, so they are unit-tested without a browser.
 *
 * Grammar: one y-axis, thin lines, recessive grid, crosshair tooltip with exact values and dates,
 * gaps shown as gaps (nulls are never connected or filled).
 */

import type { EChartsCoreOption } from "echarts/core";

import { formatDate, formatNumber } from "@/lib/format";

import type { ChartTokens } from "./chart-tokens";

/** [ISO date, value]; null marks a missing observation. */
export type TimeSeriesPoint = [string, number | null];

export interface TimeSeriesInput {
  name: string;
  color: string;
  data: TimeSeriesPoint[];
  unit: string;
  decimals: number;
}

export interface SeasonalInput {
  /** Period labels on the x-axis, e.g. "W1"…"W52". */
  periods: string[];
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
}

const LINE_WIDTH = 1.5;
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
        return `${formatDate(date)}${tooltipRow(p.marker ?? "", s.name, `${formatNumber(value, s.decimals)} ${s.unit}`)}`;
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
          s.periods[i],
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
    xAxis: { type: "category", data: s.periods, boundaryGap: false, ...categoryLikeAxis(t) },
    yAxis: valueAxis(t, s.decimals),
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
