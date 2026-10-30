import type { Snapshot } from "@/lib/data/snapshot";
import {
  europeGeometry,
  type MapGeometry,
  type PlacedMarker,
  placeMarkers,
  worldGeometry,
} from "@/lib/geo/geometry";
import { MARKERS, type MarkerKind } from "@/lib/geo/markers";
import {
  colorFor,
  COUNTRY_CODES,
  countrySeries,
  type HomeState,
  homeHref,
  metricText,
  metricValue,
} from "@/lib/home/layers";

const MARKER_SIZE: Record<MarkerKind, number> = {
  terminal: 5,
  entry: 5,
  hub: 6,
  benchmark: 8,
  chokepoint: 8,
};

/** The geometry a view draws. */
export function viewGeometry(view: HomeState["view"]): MapGeometry {
  return view === "europe" ? europeGeometry() : worldGeometry();
}

/** Markers of a view, projected and spread. */
export function viewMarkers(view: HomeState["view"]): PlacedMarker[] {
  return placeMarkers(
    viewGeometry(view),
    MARKERS.filter((m) => m.view === view),
  );
}

function MarkerShape({
  marker,
  fill,
  selected,
}: {
  marker: PlacedMarker;
  fill: string;
  selected: boolean;
}) {
  const r = MARKER_SIZE[marker.kind];
  const stroke = {
    stroke: selected ? "var(--primary)" : "var(--foreground)",
    strokeWidth: selected ? 2.5 : 1,
    strokeDasharray: marker.series === null ? "2 2" : undefined,
  };
  switch (marker.kind) {
    case "entry":
      // A square: pipeline entry points.
      return (
        <rect
          x={marker.x - r}
          y={marker.y - r}
          width={2 * r}
          height={2 * r}
          fill={fill}
          {...stroke}
        />
      );
    case "hub":
      // A diamond: virtual trading hubs.
      return (
        <polygon
          points={`${marker.x},${marker.y - r} ${marker.x + r},${marker.y} ${marker.x},${marker.y + r} ${marker.x - r},${marker.y}`}
          fill={fill}
          {...stroke}
        />
      );
    case "chokepoint":
      return <circle cx={marker.x} cy={marker.y} r={r} fill="none" {...stroke} strokeWidth={2} />;
    default:
      return <circle cx={marker.x} cy={marker.y} r={r} fill={fill} {...stroke} />;
  }
}

/**
 * The home page map, rendered on the server as plain SVG. Every coloured country and every marker is
 * a link that selects it (`?focus=`), so the map works with a keyboard and without JavaScript; the
 * native tooltip (`<title>`) states the value in words.
 */
export function EnergyMap({
  state,
  snapshots,
}: {
  state: HomeState;
  snapshots: Map<string, Snapshot>;
}) {
  const geometry = viewGeometry(state.view);
  const markers = viewMarkers(state.view);
  const label =
    state.view === "europe"
      ? "Map of Europe: countries coloured by the selected layer and metric, with LNG terminals, pipeline entry points and gas hubs"
      : "World map of oil and gas benchmarks and shipping chokepoints";

  return (
    <svg
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      className="h-auto w-full"
      role="group"
      aria-label={label}
    >
      <rect width={geometry.width} height={geometry.height} fill="var(--map-water)" />
      {geometry.countries.map((country, index) => {
        const cc = state.view === "europe" ? COUNTRY_CODES[country.id] : undefined;
        const series = cc ? countrySeries(state.layer, cc) : null;
        if (!cc || !series) {
          return (
            <path
              key={`${country.id}-${index}`}
              d={country.d}
              fill="var(--map-land)"
              stroke="var(--map-stroke)"
              strokeWidth={0.5}
            >
              <title>{country.name}</title>
            </path>
          );
        }
        const value = metricValue(snapshots.get(series), state.metric);
        const selected = state.focus === cc;
        return (
          <a
            key={`${country.id}-${index}`}
            href={homeHref(state, { focus: cc })}
            aria-label={`${country.name}: ${metricText(state.metric, value)}`}
            className="outline-none focus-visible:opacity-80"
          >
            <path
              d={country.d}
              fill={colorFor(state.metric, value)}
              stroke={selected ? "var(--primary)" : "var(--map-stroke)"}
              strokeWidth={selected ? 2 : 0.6}
              className="transition-opacity hover:opacity-80"
            >
              <title>{`${country.name}: ${metricText(state.metric, value)}`}</title>
            </path>
          </a>
        );
      })}
      {markers.map((marker) => {
        const value = marker.series
          ? metricValue(snapshots.get(marker.series), state.metric)
          : null;
        const text = `${marker.label}: ${marker.series ? metricText(state.metric, value) : "no data"}`;
        return (
          <a
            key={marker.id}
            href={homeHref(state, { focus: marker.id })}
            aria-label={text}
            className="outline-none focus-visible:opacity-80"
          >
            <MarkerShape
              marker={marker}
              fill={colorFor(state.metric, value)}
              selected={state.focus === marker.id}
            />
            <title>{text}</title>
          </a>
        );
      })}
    </svg>
  );
}
