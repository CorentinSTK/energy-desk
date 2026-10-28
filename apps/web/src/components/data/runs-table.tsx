import { Badge } from "@/components/ui/badge";
import type { IngestRun } from "@/lib/data/catalog";
import { SOURCE_LABELS } from "@/lib/data/filters";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<IngestRun["status"], string> = {
  ok: "text-positive",
  partial: "text-warning",
  failed: "text-negative",
  running: "text-muted-foreground",
  skipped: "text-muted-foreground",
};

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** Recent ingestion runs, failures included: problems are shown, never hidden (BUILD_SPEC §9). */
export function RunsTable({ runs }: { runs: IngestRun[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Started (UTC)</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Rows written</th>
            <th className="px-3 py-2 text-right font-medium">Rejected</th>
            <th className="px-3 py-2 font-medium">Problems</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {runs.map((run) => (
            <tr key={run.id} className="align-top">
              <td className="px-3 py-2 whitespace-nowrap">{formatTimestamp(run.startedAt)}</td>
              <td className="px-3 py-2">{SOURCE_LABELS[run.source] ?? run.source}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className={cn("font-normal", STATUS_STYLE[run.status])}>
                  {run.status}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right">{formatNumber(run.rowsWritten, 0)}</td>
              <td className="px-3 py-2 text-right">{formatNumber(run.rowsRejected, 0)}</td>
              <td className="max-w-md px-3 py-2 text-xs text-text-secondary">
                {run.error ? (
                  <details>
                    <summary className="cursor-pointer">{run.error.split("\n")[0]}</summary>
                    <pre className="mt-1 font-mono text-xs whitespace-pre-wrap">{run.error}</pre>
                  </details>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
