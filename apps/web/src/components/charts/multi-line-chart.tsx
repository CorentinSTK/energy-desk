"use client";

import { useCallback } from "react";

import type { ChartTokens } from "./chart-tokens";
import { EChart } from "./echart";
import { type MultiLineInput, multiLineOption } from "./options";

interface MultiLineChartProps extends MultiLineInput {
  height: number;
  ariaLabel: string;
}

export function MultiLineChart({
  series,
  unit,
  decimals,
  stacked,
  height,
  ariaLabel,
}: MultiLineChartProps) {
  const build = useCallback(
    (t: ChartTokens) => multiLineOption(t, { series, unit, decimals, stacked }),
    [series, unit, decimals, stacked],
  );
  return <EChart build={build} height={height} ariaLabel={ariaLabel} />;
}
