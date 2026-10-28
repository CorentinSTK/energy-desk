import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Optional action, e.g. a retry button rendered by a client component. */
  action?: React.ReactNode;
  className?: string;
}

/** Loading the data failed. Says so plainly; never shows stale or partial numbers as if they were current. */
export function ErrorState({
  title = "Could not load this data",
  description = "The data source or our database did not respond. Try again later.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-10 text-center",
        className,
      )}
    >
      <TriangleAlert className="size-5 text-negative" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
