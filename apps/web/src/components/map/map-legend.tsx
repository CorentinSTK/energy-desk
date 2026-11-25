import { legend, METRICS, type Metric, type View } from "@/lib/home/layers";

const MARKER_KEY: Record<View, { shape: string; label: string }[]> = {
  europe: [
    { shape: "circle", label: "LNG terminal (send-out)" },
    { shape: "square", label: "Pipeline entry point (flow)" },
    { shape: "diamond", label: "Gas hub (virtual)" },
  ],
  world: [
    { shape: "circle", label: "Price benchmark" },
    { shape: "ring", label: "Shipping chokepoint (no data yet)" },
  ],
};

function Shape({ shape }: { shape: string }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0" aria-hidden>
      {shape === "square" && (
        <rect
          x="2"
          y="2"
          width="8"
          height="8"
          fill="var(--map-nodata)"
          stroke="var(--foreground)"
        />
      )}
      {shape === "diamond" && (
        <polygon points="6,1 11,6 6,11 1,6" fill="var(--map-nodata)" stroke="var(--foreground)" />
      )}
      {shape === "circle" && (
        <circle cx="6" cy="6" r="4.5" fill="var(--map-nodata)" stroke="var(--foreground)" />
      )}
      {shape === "ring" && (
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
      )}
    </svg>
  );
}

/** Colour scale as one segmented bar (low to high), then "no data" and the marker shapes. */
export function MapLegend({ metric, view }: { metric: Metric; view: View }) {
  const title = METRICS.find((m) => m.id === metric)?.label ?? "";
  const items = legend(metric);
  const scale = items.filter((item) => item.label !== "No data");
  const noData = items.find((item) => item.label === "No data");
  return (
    <div className="flex flex-col gap-3 text-xs">
      <div className="min-w-0 space-y-1.5">
        <p className="font-medium text-text-secondary">{title}</p>
        <div className="flex items-start gap-3">
          <ul className="flex min-w-0 flex-1 sm:max-w-xl">
            {scale.map((item) => (
              <li
                key={item.label}
                className="min-w-0 flex-1 space-y-1 first:[&>span:first-child]:rounded-l-full last:[&>span:first-child]:rounded-r-full"
              >
                <span className="block h-2" style={{ background: item.color }} aria-hidden />
                <span className="block px-0.5 text-center text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          {noData && (
            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
              <span
                className="size-2.5 rounded-sm ring-1 ring-border"
                style={{ background: noData.color }}
                aria-hidden
              />
              {noData.label}
            </span>
          )}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-text-secondary">
        {MARKER_KEY[view].map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <Shape shape={item.shape} />
            {item.label}
          </li>
        ))}
        <li className="text-muted-foreground">Dashed outline: no data</li>
      </ul>
    </div>
  );
}
