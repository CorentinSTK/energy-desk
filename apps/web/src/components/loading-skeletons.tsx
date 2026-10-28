import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder with the same footprint as a KpiCard, so the layout does not jump when data arrives. */
export function KpiCardSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </CardContent>
    </Card>
  );
}

/** Placeholder for the plot area of a ChartCard. */
export function ChartSkeleton({ height }: { height: number }) {
  return (
    <Skeleton aria-busy="true" aria-label="Loading chart" className="w-full" style={{ height }} />
  );
}

export function ChartCardSkeleton({ height }: { height: number }) {
  return (
    <Card aria-busy="true" aria-label="Loading">
      <CardHeader className="space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </CardHeader>
      <CardContent>
        <ChartSkeleton height={height} />
      </CardContent>
    </Card>
  );
}
