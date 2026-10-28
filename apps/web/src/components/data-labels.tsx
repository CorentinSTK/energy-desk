import { FlaskConical, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/** Exact wording required by ADR 0003 on every chart that uses Yahoo Finance data. */
export const UNOFFICIAL_LABEL = "Yahoo Finance — unofficial, delayed, research only";

/** Exact wording required on every style-guide card (synthetic data only). */
export const DEMO_LABEL = "DEMO — synthetic data, not market data";

export function UnofficialDataLabel({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-warning", className)}>
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
      {UNOFFICIAL_LABEL}
    </p>
  );
}

export function DemoBanner({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-warning/50 px-2 py-1 text-xs font-medium text-warning",
        className,
      )}
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      {DEMO_LABEL}
    </p>
  );
}
