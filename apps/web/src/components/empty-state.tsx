import { Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

/** The query worked but returned nothing (e.g. no observations in the selected range). */
export function EmptyState({
  title = "No data for this selection",
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-10 text-center",
        className,
      )}
    >
      <Inbox className="size-5 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
