import { CircleSlash } from "lucide-react";

import { cn } from "@/lib/utils";

interface DataGapNoticeProps {
  title: string;
  /** Why the data is missing: no free source, licensing, source outage… */
  reason: React.ReactNode;
  className?: string;
}

/** A market or series we do not cover, shown as missing rather than estimated (BUILD_SPEC §1). */
export function DataGapNotice({ title, reason, className }: DataGapNoticeProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-dashed border-border-strong p-4 text-sm",
        className,
      )}
    >
      <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <div className="text-text-secondary">{reason}</div>
      </div>
    </div>
  );
}
