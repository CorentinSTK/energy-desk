"use client";

import { useCallback } from "react";

import type { ChartTokens } from "./chart-tokens";
import { EChart } from "./echart";
import { type BarInput, barOption } from "./options";

interface BarChartProps extends BarInput {
  height: number;
  ariaLabel: string;
}

export function BarChart({
  categories,
  series,
  unit,
  decimals,
  stacked,
  height,
  ariaLabel,
}: BarChartProps) {
  const build = useCallback(
    (t: ChartTokens) => barOption(t, { categories, series, unit, decimals, stacked }),
    [categories, series, unit, decimals, stacked],
  );
  return <EChart build={build} height={height} ariaLabel={ariaLabel} />;
}
