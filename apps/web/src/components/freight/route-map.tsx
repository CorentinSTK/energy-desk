import { COMMODITIES } from "@/lib/commodities";
import { CHOKEPOINTS, type ChokepointId } from "@/lib/freight/chokepoints";
import { DISRUPTED_BELOW_NORM_PCT, variantStates } from "@/lib/freight/route-map";
import { ROUTES } from "@/lib/freight/routes";
import { worldGeometry } from "@/lib/geo/geometry";
import { formatChange, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Approximate positions of the chokepoints, for drawing only (Natural Earth places and areas). */
const CHOKE_AT: Record<ChokepointId, [number, number]> = {
  hormuz: [56.4, 26.6],
  bab_el_mandeb: [43.4, 12.6],
  suez: [32.55, 30.0],
  cape: [18.5, -34.4],
  malacca: [99.3, 4.9],
  panama: [-79.9, 9.4],
  bosporus: [29.05, 41.1],
  gibraltar: [-5.6, 35.95],
};

/** Vertical crop of the world map: the routes stay between about 62° N and 45° S. */
const TOP_LAT = 66;
const BOTTOM_LAT = -48;

export interface ChokepointStatus {
  id: ChokepointId;
  deviationPct: number | null;
  disrupted: boolean;
}

/**
 * Benchmark sea routes on a world map. The route ships would take now is drawn with moving dashes;
 * a variant through a disrupted chokepoint is drawn in the warning colour; other variants are thin.
 * Rendered on the server as SVG; the motion is CSS and stops under reduced motion.
 */
export function RouteMap({ status }: { status: ChokepointStatus[] }) {
  const g = worldGeometry();
  const disrupted = new Set(status.filter((s) => s.disrupted).map((s) => s.id));
  const top = g.project(0, TOP_LAT)?.[1] ?? 0;
  const bottom = g.project(0, BOTTOM_LAT)?.[1] ?? g.height;
  const byId = new Map(status.map((s) => [s.id, s]));

  return (
    <figure className="space-y-3" aria-label="Sea route map">
      <div className="overflow-hidden rounded-lg border">
        <svg
          viewBox={`0 ${top} ${g.width} ${bottom - top}`}
          className="h-auto w-full"
          role="img"
          aria-label="World map of benchmark crude and LNG sea routes and the chokepoints they cross"
        >
          <rect x="0" y={top} width={g.width} height={bottom - top} fill="var(--map-water)" />
          {g.countries.map((c, i) => (
            <path
              key={`${c.id}-${i}`}
              d={c.d}
              fill="var(--map-land)"
              stroke="var(--map-stroke)"
              strokeWidth={0.4}
            />
          ))}
          {ROUTES.flatMap((route) => {
            const states = variantStates(route, disrupted);
            const colour = `var(${COMMODITIES[route.cargo === "crude" ? "crude" : "lng"].cssVar})`;
            return route.variants.map((v, i) => {
              const d = g.line(v.path);
              const state = states[i];
              return (
                <path
                  key={`${route.id}-${v.via}`}
                  d={d}
                  fill="none"
                  stroke={state === "disrupted" ? "var(--negative)" : colour}
                  strokeWidth={state === "in use" ? 2 : 1.2}
                  strokeOpacity={state === "alternative" ? 0.35 : 0.95}
                  strokeLinecap="round"
                  strokeDasharray={state === "disrupted" ? "3 4" : undefined}
                  className={cn(state === "in use" && "route-flow")}
                >
                  <title>{`${route.label}, via ${v.via}: ${formatNumber(v.nm, 0)} nm, ${formatNumber(v.days, 1)} days at sea (${state})`}</title>
                </path>
              );
            });
          })}
          {ROUTES.flatMap((r) => [r.origin, r.destination]).map((p) => {
            const xy = g.project(p.lon, p.lat);
            return xy ? (
              <circle
                key={`${p.name}-${p.lon}`}
                cx={xy[0]}
                cy={xy[1]}
                r={2.6}
                fill="var(--foreground)"
              >
                <title>{p.standsFor ? `${p.name} (for ${p.standsFor})` : p.name}</title>
              </circle>
            ) : null;
          })}
          {CHOKEPOINTS.map((c) => {
            const xy = g.project(...CHOKE_AT[c.id]);
            const s = byId.get(c.id);
            if (!xy) return null;
            return (
              <g key={c.id}>
                {s?.disrupted && (
                  <circle
                    cx={xy[0]}
                    cy={xy[1]}
                    r={6}
                    fill="none"
                    stroke="var(--negative)"
                    className="choke-pulse"
                  />
                )}
                <circle
                  cx={xy[0]}
                  cy={xy[1]}
                  r={3.6}
                  fill="var(--surface-raised)"
                  stroke={s?.disrupted ? "var(--negative)" : "var(--foreground)"}
                  strokeWidth={1.4}
                >
                  <title>
                    {`${c.label}: ${
                      s?.deviationPct == null
                        ? "no recent tanker data"
                        : `tanker transits ${formatChange(s.deviationPct, 0)}% against the norm, last 7 days`
                    }`}
                  </title>
                </circle>
                {s?.disrupted && s.deviationPct !== null && (
                  <text
                    x={xy[0] + 9}
                    y={xy[1] - 7}
                    className="fill-negative text-[11px] font-semibold"
                    stroke="var(--map-water)"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {`${c.label.replace("Strait of ", "")} ${formatChange(s.deviationPct, 0)}%`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-crude" aria-hidden /> Crude
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded bg-lng" aria-hidden /> LNG
        </span>
        <span>Moving line: the route ships would take now</span>
        <span>Faint line: longer alternative</span>
        <span className="flex items-center gap-1.5 text-negative">
          <span className="h-0 w-5 border-t-2 border-dashed border-negative" aria-hidden />
          Through a chokepoint with tanker traffic {DISRUPTED_BELOW_NORM_PCT}% or more below normal
        </span>
      </figcaption>
    </figure>
  );
}
