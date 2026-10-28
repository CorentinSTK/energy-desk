"use client";

import { useCallback } from "react";

import type { Commodity } from "@/lib/commodities";

import type { ChartTokens } from "./chart-tokens";
import { EChart } from "./echart";
import { type TimeSeriesPoint, timeSeriesOption } from "./options";

interface TimeSeriesChartProps {
  name: string;
  commodity: Commodity;
  data: TimeSeriesPoint[];
  unit: string;
  decimals: number;
  height: number;
  ariaLabel: string;
}

export function TimeSeriesChart({
  name,
  commodity,
  data,
  unit,
  decimals,
  height,
  ariaLabel,
}: TimeSeriesChartProps) {
  const build = useCallback(
    (t: ChartTokens) =>
      timeSeriesOption(t, { name, color: t.commodity[commodity], data, unit, decimals }),
    [name, commodity, data, unit, decimals],
  );
  return <EChart build={build} height={height} ariaLabel={ariaLabel} />;
}
