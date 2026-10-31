import { FreshnessBadge } from "@/components/freshness-badge";
import { Badge } from "@/components/ui/badge";
import { resolveAttribution } from "@/lib/data/attribution";
import type { CatalogSeries } from "@/lib/data/catalog";
import { SOURCE_LABELS } from "@/lib/data/filters";
import { formatDate, formatNumber } from "@/lib/format";
import { freshnessStatus } from "@/lib/freshness";

interface SeriesTableProps {
  series: CatalogSeries[];
  now: Date;
  /** Source → date of its last successful run, for attributions that must quote it. */
  extractionDates: Record<string, string>;
}

/** The catalogue: what each series is, where it comes from, under which licence, and how fresh it is. */
export function SeriesTable({ series, now, extractionDates }: SeriesTableProps) {
  // Attributions are listed once per text under the table, not repeated on every row: a source such
  // as the EC bulletin has 116 series with the same attribution (and the page stays light).
  const attributions = new Map<string, string[]>();
  for (const s of series) {
    const text = resolveAttribution(s.attribution, s.source, extractionDates);
    if (!text) continue;
    const label = SOURCE_LABELS[s.source] ?? s.source;
    const sources = attributions.get(text) ?? [];
    if (!sources.includes(label)) attributions.set(text, [...sources, label]);
  }
  return (
    <div className="space-y-3">
      {/* The table scrolls inside its container on narrow screens; the page never scrolls sideways. */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Series</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Unit · frequency</th>
              <th className="px-3 py-2 font-medium">Licence</th>
              <th className="px-3 py-2 font-medium">Coverage</th>
              <th className="px-3 py-2 text-right font-medium">Gaps</th>
              <th className="px-3 py-2 font-medium">Last observation</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {series.map((s) => (
              <tr key={s.code} className="align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{s.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{s.code}</p>
                  {s.isUnofficial && (
                    <Badge variant="outline" className="mt-1 text-warning">
                      Unofficial
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <p>{SOURCE_LABELS[s.source] ?? s.source}</p>
                  <p className="font-mono text-xs break-all text-muted-foreground">{s.sourceRef}</p>
                </td>
                <td className="px-3 py-2">
                  <p>{s.unit}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.frequency}
                    {s.priceKind && ` · ${s.priceKind}`}
                  </p>
                </td>
                <td className="max-w-64 px-3 py-2">
                  {s.licenseUrl ? (
                    <a
                      href={s.licenseUrl}
                      className="text-primary underline underline-offset-2"
                      rel="noreferrer"
                      target="_blank"
                    >
                      {s.license}
                    </a>
                  ) : (
                    <p>{s.license}</p>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {s.observationCount > 0 ? (
                    <>
                      <p>
                        {formatDate(s.firstObservation)} → {formatDate(s.lastObservation)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(s.observationCount, 0)} observations
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No data yet</p>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <p>{formatNumber(s.gapCount, 0)}</p>
                  {s.largestIntervalDays !== null && (
                    <p className="text-xs text-muted-foreground">
                      max {formatNumber(s.largestIntervalDays, 0)} d
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {s.lastObservation ? (
                    <FreshnessBadge
                      status={freshnessStatus(
                        new Date(s.lastObservation),
                        s.frequency,
                        now,
                        s.publicationLagDays,
                      )}
                      lastObservation={s.lastObservation}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {attributions.size > 0 && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Attributions required by the sources</p>
          <ul className="space-y-0.5">
            {[...attributions.entries()].map(([text, sources]) => (
              <li key={text}>
                <span className="text-text-secondary">{sources.join(", ")}:</span> {text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
