"use client";

import { useCallback } from "react";

import type { ChartTokens } from "./chart-tokens";
import { EChart } from "./echart";
import { type HistogramInput, histogramOption } from "./options";

interface HistogramChartProps extends HistogramInput {
  height: number;
  ariaLabel: string;
}

export function HistogramChart({
  labels,
  counts,
  negative,
  countLabel,
  height,
  ariaLabel,
}: HistogramChartProps) {
  const build = useCallback(
    (t: ChartTokens) => histogramOption(t, { labels, counts, negative, countLabel }),
    [labels, counts, negative, countLabel],
  );
  return <EChart build={build} height={height} ariaLabel={ariaLabel} />;
}
