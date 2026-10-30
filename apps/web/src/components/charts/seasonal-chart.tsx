"use client";

import { useCallback } from "react";

import type { Commodity } from "@/lib/commodities";

import type { ChartTokens } from "./chart-tokens";
import { EChart } from "./echart";
import { type SeasonalInput, seasonalOption } from "./options";

interface SeasonalChartProps extends Omit<SeasonalInput, "color"> {
  commodity: Commodity;
  height: number;
  ariaLabel: string;
}

export function SeasonalChart({ commodity, height, ariaLabel, ...input }: SeasonalChartProps) {
  const {
    periods,
    dailyAxis,
    weeklyAxis,
    min,
    max,
    average,
    current,
    currentLabel,
    rangeLabel,
    unit,
    decimals,
    yMax,
  } = input;
  const build = useCallback(
    (t: ChartTokens) =>
      seasonalOption(t, {
        periods,
        dailyAxis,
        weeklyAxis,
        min,
        max,
        average,
        current,
        currentLabel,
        rangeLabel,
        unit,
        decimals,
        yMax,
        color: t.commodity[commodity],
      }),
    [
      periods,
      dailyAxis,
      weeklyAxis,
      min,
      max,
      average,
      current,
      currentLabel,
      rangeLabel,
      unit,
      decimals,
      yMax,
      commodity,
    ],
  );
  return <EChart build={build} height={height} ariaLabel={ariaLabel} />;
}
