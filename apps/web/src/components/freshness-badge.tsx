import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { FreshnessStatus } from "@/lib/freshness";
import { cn } from "@/lib/utils";

const STATUS: Record<FreshnessStatus, { label: string; dot: string }> = {
  fresh: { label: "Fresh", dot: "bg-status-fresh" },
  delayed: { label: "Delayed", dot: "bg-status-delayed" },
  stale: { label: "Stale", dot: "bg-status-stale" },
};

interface FreshnessBadgeProps {
  status: FreshnessStatus;
  lastObservation?: string | Date;
  className?: string;
}

/** Fresh / delayed / stale. The word carries the meaning; the dot colour only reinforces it. */
export function FreshnessBadge({ status, lastObservation, className }: FreshnessBadgeProps) {
  const { label, dot } = STATUS[status];
  const title =
    lastObservation === undefined ? undefined : `Last observation ${formatDate(lastObservation)}`;

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", className)} title={title}>
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </Badge>
  );
}
