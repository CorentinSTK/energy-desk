import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { DemoBanner, UnofficialDataLabel } from "@/components/data-labels";
import { Card, CardContent } from "@/components/ui/card";
import { COMMODITIES, type Commodity } from "@/lib/commodities";
import {
  decimalsFor,
  formatChange,
  formatDate,
  formatNumber,
  formatPercentChange,
} from "@/lib/format";
import { cn } from "@/lib/utils";

interface KpiChange {
  value: number | null;
  /** Comparison basis, e.g. "vs last week". */
  label: string;
  /** True when `value` is a percentage change (in percent), false for a change in the KPI's unit. */
  percent?: boolean;
}

interface KpiContext {
  label: string;
  /** Already formatted (e.g. "−18.2%", "92nd pct"). */
  value: string;
}

interface KpiCardProps {
  label: string;
  value: number | null;
  unit: string;
  decimals?: number;
  change?: KpiChange;
  /** Comparisons that give the number meaning: vs 5Y average, percentile in history (BUILD_SPEC §2.4). */
  context?: KpiContext[];
  commodity?: Commodity;
  demo?: boolean;
  /** Value from an unofficial source: shows the mandatory label (ADR 0003). */
  unofficial?: boolean;
  /** Date of the value, shown under the label. */
  asOf?: string;
  className?: string;
}

export function KpiCard({
  label,
  value,
  unit,
  decimals = decimalsFor(unit),
  change,
  context = [],
  commodity,
  demo = false,
  unofficial = false,
  asOf,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn("relative gap-0 overflow-hidden py-4", className)}>
      {commodity && (
        <span
          className={cn("absolute inset-y-0 left-0 w-0.5", COMMODITIES[commodity].bgClass)}
          aria-hidden
        />
      )}
      <CardContent className="space-y-1.5">
        {demo && <DemoBanner className="mb-2 w-fit" />}
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        {asOf && <p className="text-xs text-muted-foreground">{formatDate(asOf)}</p>}
        <p className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold">{formatNumber(value, decimals)}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </p>
        {change && <ChangeLine change={change} decimals={decimals} />}
        {context.length > 0 && (
          <dl className="space-y-0.5 pt-1 text-xs">
            {context.map((item) => (
              <div key={item.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {unofficial && <UnofficialDataLabel className="pt-1" />}
      </CardContent>
    </Card>
  );
}

function ChangeLine({ change, decimals }: { change: KpiChange; decimals: number }) {
  const text = change.percent
    ? formatPercentChange(change.value)
    : formatChange(change.value, decimals);
  // Direction of the value as displayed: a change that rounds to zero is neutral, not red or green.
  const shownDecimals = change.percent ? 1 : decimals;
  const rounded =
    change.value === null
      ? 0
      : Math.round(change.value * 10 ** shownDecimals) / 10 ** shownDecimals;
  const direction = Math.sign(rounded);
  const Icon = direction > 0 ? ArrowUpRight : direction < 0 ? ArrowDownRight : ArrowRight;

  return (
    <p className="flex items-center gap-1 text-sm">
      <span
        className={cn(
          "flex items-center gap-0.5 font-medium",
          direction > 0 && "text-positive",
          direction < 0 && "text-negative",
          direction === 0 && "text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
        {text}
      </span>
      <span className="text-muted-foreground">{change.label}</span>
    </p>
  );
}
