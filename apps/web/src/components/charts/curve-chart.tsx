"use client";

import { useCallback } from "react";

import type { ChartTokens } from "./chart-tokens";
import { EChart } from "./echart";
import { type CurveInput, curveOption } from "./options";

interface CurveChartProps extends CurveInput {
  height: number;
  ariaLabel: string;
}

export function CurveChart({ tenors, series, unit, decimals, height, ariaLabel }: CurveChartProps) {
  const build = useCallback(
    (t: ChartTokens) => curveOption(t, { tenors, series, unit, decimals }),
    [tenors, series, unit, decimals],
  );
  return <EChart build={build} height={height} ariaLabel={ariaLabel} />;
}
