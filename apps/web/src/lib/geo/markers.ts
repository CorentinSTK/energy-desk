/**
 * Map markers: where each terminal, entry point, hub, benchmark and chokepoint is drawn.
 *
 * Positions come from Natural Earth 5.1.2 (public domain): the `ports` and `populated places`
 * datasets, or the centroid of a `marine polys` area. When the exact site is not in Natural Earth,
 * the nearest listed port or town is used and the distance is noted (up to about 50 km). Positions
 * are for drawing only: no number on the site is computed from them.
 *
 * Markers that share a reference point are spread by the map renderer so each stays clickable.
 */

export type MarkerKind = "terminal" | "entry" | "hub" | "benchmark" | "chokepoint";

export interface MarkerDef {
  id: string;
  kind: MarkerKind;
  label: string;
  lat: number;
  lon: number;
  /** Where the position comes from (Natural Earth feature, and distance when not on site). */
  position: string;
  /** Main series: drives the marker colour and the drawer. Null = no data (shown as such). */
  series: string | null;
  /** Second series shown in the drawer (e.g. terminal inventory). */
  secondary?: string;
  /** Market page with the full data. */
  href: string;
  view: "europe" | "world";
  /** Shown in the drawer, e.g. why there is no data. */
  note?: string;
}

const NE_PORT = "Natural Earth port";
const NE_PLACE = "Natural Earth populated place";

function terminal(
  slug: string,
  label: string,
  lat: number,
  lon: number,
  position: string,
): MarkerDef {
  return {
    id: `lng-${slug.replaceAll("_", "-")}`,
    kind: "terminal",
    label,
    lat,
    lon,
    position,
    series: `alsi.t.${slug}.send_out`,
    secondary: `alsi.t.${slug}.inventory`,
    href: "/markets/lng",
    view: "europe",
  };
}

function entry(code: string, label: string, lat: number, lon: number, position: string): MarkerDef {
  return {
    id: `entry-${code.replaceAll("_", "-")}`,
    kind: "entry",
    label,
    lat,
    lon,
    position,
    series: `entsog.${code}`,
    href: "/markets/gas?tab=flows",
    view: "europe",
  };
}

/** The 29 EU LNG terminals with ALSI data (worker/catalog/gie_alsi.yaml, generated block). */
export const TERMINALS: MarkerDef[] = [
  terminal("zeebrugge", "Zeebrugge LNG", 51.336, 3.205, `${NE_PORT} Zeebrugge`),
  terminal(
    "brunsbuettel_1",
    "Brunsbüttel LNG (FSRU)",
    53.865,
    8.707,
    `${NE_PORT} Cuxhaven, ~25 km`,
  ),
  terminal("mukran", "Mukran LNG (FSRU)", 54.3, 13.1, `${NE_PLACE} Stralsund, ~50 km`),
  terminal(
    "wilhelmshaven_1",
    "Wilhelmshaven LNG 1 (FSRU)",
    53.53,
    8.122,
    `${NE_PORT} Wilhelmshaven`,
  ),
  terminal(
    "wilhelmshaven_2",
    "Wilhelmshaven LNG 2 (FSRU)",
    53.53,
    8.122,
    `${NE_PORT} Wilhelmshaven`,
  ),
  terminal("barcelona", "Barcelona LNG", 41.355, 2.169, `${NE_PORT} Barcelona`),
  terminal("bilbao", "Bilbao LNG", 43.343, -3.027, `${NE_PORT} Bilbao`),
  terminal("cartagena", "Cartagena LNG", 37.589, -0.986, `${NE_PORT} Cartagena`),
  terminal("el_musel", "El Musel LNG", 43.559, -5.689, `${NE_PORT} Gijon`),
  terminal("huelva", "Huelva LNG", 37.193, -6.936, `${NE_PORT} Huelva`),
  terminal("mugardos", "Mugardos LNG", 43.48, -8.251, `${NE_PORT} Ferrol, ~5 km`),
  terminal("sagunto", "Sagunto LNG", 39.444, -0.318, `${NE_PORT} Valencia, ~25 km`),
  terminal("inkoo", "Inkoo LNG (FSRU)", 60.16, 24.96, `${NE_PORT} Helsinki, ~50 km`),
  terminal("dunkerque", "Dunkerque LNG", 51.022, 2.171, `${NE_PORT} Dunkerque`),
  terminal("fos_cavaou", "Fos Cavaou LNG", 43.329, 5.341, `${NE_PORT} Marseille, ~40 km`),
  terminal("fos_tonkin", "Fos Tonkin LNG", 43.329, 5.341, `${NE_PORT} Marseille, ~40 km`),
  terminal(
    "montoir_de_bretagne",
    "Montoir-de-Bretagne LNG",
    47.21,
    -1.59,
    `${NE_PLACE} Nantes, ~50 km`,
  ),
  terminal(
    "alexandroupolis",
    "Alexandroupolis LNG (FSRU)",
    40.841,
    25.889,
    `${NE_PORT} Alexandroupolis`,
  ),
  terminal("revythoussa", "Revythoussa LNG", 37.937, 23.657, `${NE_PORT} Piraeus, ~30 km`),
  terminal("krk", "Krk LNG (FSRU)", 45.328, 14.422, `${NE_PORT} Rijeka, ~15 km`),
  terminal(
    "olt_offshore",
    "OLT Offshore LNG (FSRU Toscana)",
    43.556,
    10.302,
    `${NE_PORT} Livorno, ~20 km`,
  ),
  terminal("panigaglia", "Panigaglia LNG", 44.087, 9.85, `${NE_PORT} La Spezia, ~5 km`),
  terminal("ravenna", "Ravenna LNG (FSRU)", 44.462, 12.25, `${NE_PORT} Ravenna`),
  terminal("rovigo", "Adriatic LNG (Rovigo)", 45.439, 12.335, `${NE_PLACE} Venice, ~50 km`),
  terminal("klaipeda", "Klaipėda LNG (FSRU)", 55.687, 21.134, `${NE_PORT} Klaipeda`),
  terminal("eemsenergy", "EemsEnergy LNG (FSRU)", 53.321, 6.955, `${NE_PORT} Delfzijl, ~15 km`),
  terminal("rotterdam_gate", "Gate LNG (Rotterdam)", 51.927, 4.293, `${NE_PORT} Rotterdam`),
  terminal("swinoujscie", "Świnoujście LNG", 53.905, 14.269, `${NE_PORT} Swinoujscie`),
  terminal("sines", "Sines LNG", 37.943, -8.867, `${NE_PORT} Sines`),
];

/** The nine ENTSOG entry points shown on the gas page (worker/catalog/entsog.yaml). */
export const ENTRY_POINTS: MarkerDef[] = [
  entry("dunkerque", "Dunkerque (Norway → France)", 51.022, 2.171, `${NE_PORT} Dunkerque`),
  entry("zeebrugge_zpt", "Zeebrugge ZPT (Norway → Belgium)", 51.336, 3.205, `${NE_PORT} Zeebrugge`),
  entry("zeebrugge_izt", "Zeebrugge IZT (UK → Belgium)", 51.336, 3.205, `${NE_PORT} Zeebrugge`),
  entry(
    "bacton_bbl",
    "Bacton BBL (UK → Netherlands)",
    52.61,
    1.73,
    `${NE_PORT} Great Yarmouth, ~25 km`,
  ),
  entry(
    "mazara",
    "Mazara del Vallo (Algeria → Italy)",
    37.79,
    12.435,
    `${NE_PORT} Marsala, ~20 km`,
  ),
  entry("gela", "Gela (Libya → Italy)", 37.09, 13.938, `${NE_PORT} Licata, ~30 km`),
  entry("almeria", "Almería (Algeria → Spain)", 36.832, -2.471, `${NE_PORT} Almeria`),
  entry("melendugno", "Melendugno (TAP → Italy)", 40.36, 18.15, `${NE_PLACE} Lecce, ~15 km`),
  entry(
    "strandzha2",
    "Strandzha 2 (Türkiye → Bulgaria)",
    41.743,
    27.226,
    `${NE_PLACE} Kırklareli, ~30 km`,
  ),
];

/**
 * Gas hubs are virtual trading points, not places: each is drawn at its country's capital. Only TTF has
 * a daily price we can show (an unofficial NYMEX futures contract); the others are declared gaps.
 */
export const HUBS: MarkerDef[] = [
  {
    id: "hub-ttf",
    kind: "hub",
    label: "TTF (Netherlands)",
    lat: 52.352,
    lon: 4.915,
    position: `${NE_PLACE} Amsterdam (virtual hub, drawn at the capital)`,
    series: "yahoo.ttf.front_month",
    href: "/markets/gas",
    view: "europe",
    note: "NYMEX Dutch TTF front month from Yahoo Finance: unofficial, delayed, research only.",
  },
  ...(
    [
      ["nbp", "NBP (Great Britain)", 51.503, -0.067, "London"],
      ["the", "THE (Germany)", 52.524, 13.4, "Berlin"],
      ["peg", "PEG (France)", 48.869, 2.331, "Paris"],
    ] as const
  ).map(([id, label, lat, lon, city]): MarkerDef => ({
    id: `hub-${id}`,
    kind: "hub",
    label,
    lat,
    lon,
    position: `Natural Earth ${city} (virtual hub, drawn at the capital)`,
    series: null,
    href: "/markets/gas?tab=gaps",
    view: "europe",
    note: "No free, redistributable daily price exists for this hub (exchange data is licensed).",
  })),
];

export const WORLD_MARKERS: MarkerDef[] = [
  {
    id: "bench-brent",
    kind: "benchmark",
    label: "Brent (North Sea)",
    lat: 56.39,
    lon: 2.76,
    position: "Centroid of the Natural Earth North Sea marine area",
    series: "eia.brent_spot",
    href: "/markets/crude",
    view: "world",
  },
  {
    id: "bench-wti",
    kind: "benchmark",
    label: "WTI (Cushing, Oklahoma)",
    lat: 36.135,
    lon: -97.068,
    position: `${NE_PLACE} Stillwater, ~35 km`,
    series: "eia.wti_spot",
    href: "/markets/crude",
    view: "world",
  },
  {
    id: "bench-henry-hub",
    kind: "benchmark",
    label: "Henry Hub (Louisiana)",
    lat: 30.2,
    lon: -92.02,
    position: `${NE_PLACE} Lafayette, ~25 km`,
    series: "eia.henry_hub_spot",
    href: "/markets/gas",
    view: "world",
  },
  ...(
    [
      ["hormuz", "Strait of Hormuz", 27.141, 56.204, `${NE_PORT} Bandar Abbas, on the strait`],
      [
        "bab-el-mandeb",
        "Bab el-Mandeb",
        12.87,
        43.45,
        "Centroid of the Natural Earth Bab el Mandeb area",
      ],
      ["suez", "Suez Canal", 30.005, 32.55, `${NE_PLACE} Suez, southern end of the canal`],
      [
        "malacca",
        "Strait of Malacca",
        4.9,
        99.3,
        "Centroid of the Natural Earth Strait of Malacca area",
      ],
      ["panama", "Panama Canal", 9.373, -79.885, `${NE_PORT} Colon, northern end of the canal`],
    ] as const
  ).map(([id, label, lat, lon, position]): MarkerDef => ({
    id: `choke-${id}`,
    kind: "chokepoint",
    label,
    lat,
    lon,
    position,
    series: null,
    href: "/markets/crude?tab=flows",
    view: "world",
    note: "Transit data comes in the freight and shipping phase; nothing is shown until then.",
  })),
];

export const MARKERS: MarkerDef[] = [...TERMINALS, ...ENTRY_POINTS, ...HUBS, ...WORLD_MARKERS];
