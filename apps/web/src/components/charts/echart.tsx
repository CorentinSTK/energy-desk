"use client";

/**
 * Thin wrapper over echarts/core (ADR 0002). Registers only the modules we use, so the bundle stays
 * small, and rebuilds the option from design tokens whenever the theme changes.
 */

import { BarChart, LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { type ECharts, type EChartsCoreOption, init, use as registerModules } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

import { type ChartTokens, readChartTokens } from "./chart-tokens";

registerModules([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

interface EChartProps {
  /** Builds the option from resolved tokens. Must be stable (useCallback) to avoid needless redraws. */
  build: (tokens: ChartTokens) => EChartsCoreOption;
  height: number;
  /** Text alternative for screen readers: what the chart shows. */
  ariaLabel: string;
}

export function EChart({ build, height, ariaLabel }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const chart = init(element, null, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    const chart = chartRef.current;
    if (!element || !chart) return;
    chart.setOption(build(readChartTokens(element)), { notMerge: true });
  }, [build, resolvedTheme]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className="w-full"
      style={{ height }}
    />
  );
}
