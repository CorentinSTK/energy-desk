import { DemoBanner, UnofficialDataLabel } from "@/components/data-labels";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { FreshnessBadge } from "@/components/freshness-badge";
import { ChartSkeleton } from "@/components/loading-skeletons";
import { MethodPopover } from "@/components/method-popover";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { FreshnessStatus } from "@/lib/freshness";
import { cn } from "@/lib/utils";

export type ChartCardStatus = "ready" | "loading" | "empty" | "error";

export interface ChartSourceInfo {
  source: string;
  /** Required attribution text from the series licence; omitted when none is required. */
  attribution?: string;
  unit: string;
  lastObservation?: string;
  freshness?: FreshnessStatus;
  /** Data from an unofficial source (Yahoo Finance): adds the mandatory label (ADR 0003). */
  unofficial?: boolean;
}

interface ChartCardProps {
  /** The question the chart answers (BUILD_SPEC §2.1). */
  title: string;
  /** One plain-English sentence computed from the data by explicit rules. */
  takeaway?: string;
  /** Methodology note shown in the "i" popover. */
  method: React.ReactNode;
  info: ChartSourceInfo;
  status?: ChartCardStatus;
  /** Height of the plot area, kept for loading/empty/error states so the layout does not jump. */
  height?: number;
  demo?: boolean;
  /** The chart itself (usually an EChart). */
  children?: React.ReactNode;
  className?: string;
}

const DEFAULT_CHART_HEIGHT = 280;

export function ChartCard({
  title,
  takeaway,
  method,
  info,
  status = "ready",
  height = DEFAULT_CHART_HEIGHT,
  demo = false,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn("gap-3", className)}>
      <CardHeader className="gap-1">
        {demo && <DemoBanner className="mb-1 w-fit" />}
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{title}</CardTitle>
          <MethodPopover subject={title}>{method}</MethodPopover>
        </div>
        {takeaway && status === "ready" && (
          <p className="text-sm text-text-secondary">{takeaway}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {status === "ready" && info.freshness === "stale" && (
          <p className="text-xs text-negative">
            Stale: this series has not updated since {formatDate(info.lastObservation)}.
          </p>
        )}
        <div style={{ minHeight: height }}>
          {status === "loading" && <ChartSkeleton height={height} />}
          {status === "empty" && <EmptyState />}
          {status === "error" && <ErrorState />}
          {status === "ready" && children}
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-1.5 text-xs text-muted-foreground">
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Source: <span className="text-text-secondary">{info.source}</span>
          </span>
          <span>
            Unit: <span className="text-text-secondary">{info.unit}</span>
          </span>
          <span>
            Last: <span className="text-text-secondary">{formatDate(info.lastObservation)}</span>
          </span>
          {info.freshness && (
            <FreshnessBadge
              status={info.freshness}
              lastObservation={info.lastObservation}
              className="ml-auto"
            />
          )}
        </div>
        {info.attribution && <p>{info.attribution}</p>}
        {info.unofficial && <UnofficialDataLabel />}
      </CardFooter>
    </Card>
  );
}
