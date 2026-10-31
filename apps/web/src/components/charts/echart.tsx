"use client";

/**
 * Thin wrapper over echarts/core (ADR 0002). Registers only the modules we use, and rebuilds the
 * option from design tokens whenever the theme changes.
 *
 * Performance (M8, Lighthouse): ECharts is loaded with a dynamic import, in its own chunk, the first
 * time a chart is about to be seen, and each chart is created only when its container comes near the
 * viewport. Pages without charts no longer download it, and charts below the fold no longer block the
 * main thread at load. The container keeps its height, so nothing shifts when a chart appears.
 */

import type { ECharts, EChartsCoreOption } from "echarts/core";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { type ChartTokens, readChartTokens } from "./chart-tokens";

/** Start creating a chart this far before it scrolls into view. */
const VISIBILITY_MARGIN = "200px";

let echartsModule: Promise<typeof import("echarts/core")> | null = null;

/** ECharts with our modules registered, loaded once for the whole page. */
function loadEcharts(): Promise<typeof import("echarts/core")> {
  echartsModule ??= Promise.all([
    import("echarts/core"),
    import("echarts/charts"),
    import("echarts/components"),
    import("echarts/renderers"),
  ]).then(([core, charts, components, renderers]) => {
    core.use([
      charts.LineChart,
      charts.BarChart,
      components.GridComponent,
      components.TooltipComponent,
      components.LegendComponent,
      components.DataZoomComponent,
      components.MarkLineComponent,
      renderers.CanvasRenderer,
    ]);
    return core;
  });
  return echartsModule;
}

interface EChartProps {
  /** Builds the option from resolved tokens. Must be stable (useCallback) to avoid needless redraws. */
  build: (tokens: ChartTokens) => EChartsCoreOption;
  height: number;
  /** Text alternative for screen readers: what the chart shows. */
  ariaLabel: string;
}

export function EChart({ build, height, ariaLabel }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<ECharts | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let instance: ECharts | null = null;
    let cancelled = false;
    const resize = new ResizeObserver(() => instance?.resize());
    const visible = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        visible.disconnect();
        void loadEcharts().then((echarts) => {
          if (cancelled) return;
          instance = echarts.init(element, null, { renderer: "canvas" });
          resize.observe(element);
          setChart(instance);
        });
      },
      { rootMargin: VISIBILITY_MARGIN },
    );
    visible.observe(element);
    return () => {
      cancelled = true;
      visible.disconnect();
      resize.disconnect();
      instance?.dispose();
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !chart) return;
    chart.setOption(build(readChartTokens(element)), { notMerge: true });
  }, [build, chart, resolvedTheme]);

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
