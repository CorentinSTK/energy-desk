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
    // Same look as the outline Badge, without its interactive-state classes: this badge is never
    // focusable, and the /data table renders it on every row (page weight, Lighthouse).
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-4xl border px-2 text-xs whitespace-nowrap",
        className,
      )}
      title={title}
    >
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}
