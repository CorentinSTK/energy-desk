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

export function MapLegend({ metric, view }: { metric: Metric; view: View }) {
  const title = METRICS.find((m) => m.id === metric)?.label ?? "";
  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className="mb-1.5 font-medium text-foreground">{title}</p>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {legend(metric).map((item) => (
            <li key={item.label} className="flex items-center gap-1.5 text-text-secondary">
              <span
                className="size-3 shrink-0 rounded-sm border border-border"
                style={{ background: item.color }}
                aria-hidden
              />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      <ul className="space-y-1">
        {MARKER_KEY[view].map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 text-text-secondary">
            <Shape shape={item.shape} />
            {item.label}
          </li>
        ))}
        <li className="text-muted-foreground">Dashed outline: no data for this point.</li>
      </ul>
    </div>
  );
}
