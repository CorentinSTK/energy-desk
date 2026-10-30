import "server-only";

/**
 * Map geometry, projected once per server process and sent to the browser as plain SVG paths: the
 * page ships no map library and no TopoJSON (ADR 0008).
 *
 * Boundaries: world-atlas 2.0.2 (ISC), derived from Natural Earth (public domain); 1:50m for Europe,
 * 1:110m for the world view.
 */

import { type GeoProjection, geoConicConformal, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries50m from "world-atlas/countries-50m.json";
import countries110m from "world-atlas/countries-110m.json";

import type { MarkerDef } from "./markers";

export const MAP_WIDTH = 960;
export const EUROPE_HEIGHT = 820;
export const WORLD_HEIGHT = 500;
/** Coordinates are rounded to this many decimals in the SVG (in map pixels): smaller pages. */
const PATH_DIGITS = 1;
/** Markers closer than this (map pixels) are spread around their shared point. */
const SPREAD_DISTANCE = 4;
const SPREAD_RADIUS = 9;

/**
 * Europe as framed on the map: Iberia to Finland, the Atlantic coast to Cyprus. The frame is sampled
 * along both parallels because conic parallels are arcs: corners alone would cut off Malta and Sicily.
 */
const FRAME_WEST = -11;
const FRAME_EAST = 35;
const FRAME_SOUTH = 34;
const FRAME_NORTH = 70.5;
const EUROPE_FRAME: Feature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "MultiPoint",
    coordinates: Array.from(
      { length: FRAME_EAST - FRAME_WEST + 1 },
      (_, i) => FRAME_WEST + i,
    ).flatMap((lon) => [
      [lon, FRAME_SOUTH],
      [lon, FRAME_NORTH],
    ]),
  },
};

export interface CountryShape {
  /** ISO 3166-1 numeric code, as in world-atlas. */
  id: string;
  name: string;
  d: string;
}

export interface PlacedMarker extends MarkerDef {
  x: number;
  y: number;
}

export interface MapGeometry {
  width: number;
  height: number;
  countries: CountryShape[];
  project: (lon: number, lat: number) => [number, number] | null;
}

type Countries = Topology<{ countries: GeometryCollection<{ name: string }> }>;

function shapes(topology: Countries, projection: GeoProjection): CountryShape[] {
  const collection = feature(topology, topology.objects.countries) as FeatureCollection<
    Geometry,
    { name: string }
  >;
  const path = geoPath(projection).digits(PATH_DIGITS);
  return collection.features.flatMap((f) => {
    const d = path(f);
    return d ? [{ id: String(f.id), name: f.properties.name, d }] : [];
  });
}

function build(topology: Countries, projection: GeoProjection, height: number): MapGeometry {
  return {
    width: MAP_WIDTH,
    height,
    countries: shapes(topology, projection),
    project: (lon, lat) => {
      const point = projection([lon, lat]);
      if (!point) return null;
      const [x, y] = point;
      return x >= 0 && x <= MAP_WIDTH && y >= 0 && y <= height ? [x, y] : null;
    },
  };
}

let europe: MapGeometry | null = null;
let world: MapGeometry | null = null;

export function europeGeometry(): MapGeometry {
  if (!europe) {
    const projection = geoConicConformal()
      .rotate([-10, 0])
      .parallels([40, 65])
      .fitExtent(
        [
          [8, 8],
          [MAP_WIDTH - 8, EUROPE_HEIGHT - 8],
        ],
        EUROPE_FRAME,
      );
    projection.clipExtent([
      [0, 0],
      [MAP_WIDTH, EUROPE_HEIGHT],
    ]);
    europe = build(countries50m as unknown as Countries, projection, EUROPE_HEIGHT);
  }
  return europe;
}

export function worldGeometry(): MapGeometry {
  if (!world) {
    const projection = geoNaturalEarth1().fitSize([MAP_WIDTH, WORLD_HEIGHT], { type: "Sphere" });
    world = build(countries110m as unknown as Countries, projection, WORLD_HEIGHT);
  }
  return world;
}

/**
 * Project markers; markers that land on the same point (e.g. two terminals in one port) are spread
 * on a small circle around it, in list order, so each stays visible and clickable.
 */
export function placeMarkers(geometry: MapGeometry, markers: MarkerDef[]): PlacedMarker[] {
  const placed = markers.flatMap((m) => {
    const point = geometry.project(m.lon, m.lat);
    return point ? [{ ...m, x: point[0], y: point[1] }] : [];
  });
  const groups: PlacedMarker[][] = [];
  for (const marker of placed) {
    const group = groups.find(
      (g) => Math.hypot(g[0].x - marker.x, g[0].y - marker.y) < SPREAD_DISTANCE,
    );
    if (group) group.push(marker);
    else groups.push([marker]);
  }
  return groups.flatMap((group) =>
    group.length === 1
      ? group
      : group.map((m, i) => {
          const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
          return {
            ...m,
            x: group[0].x + SPREAD_RADIUS * Math.cos(angle),
            y: group[0].y + SPREAD_RADIUS * Math.sin(angle),
          };
        }),
  );
}
