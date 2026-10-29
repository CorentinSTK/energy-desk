import "server-only";

/**
 * Generation groups shown in the mix chart. Each group is a sum of distinct fuel categories reported
 * by the source (never overlapping reports). `color` is a 0-based index into the chart palette, so a
 * fuel keeps its colour across zones. Pumped storage is "Other": it stores power, it is not a fuel.
 */
interface FuelGroup {
  name: string;
  color: number;
  renewable: boolean;
  codes: string[];
}

export interface PowerZone {
  id: "de" | "fr" | "gb";
  label: string;
  /** Price series: intraday (hourly or half-hourly) and the daily average. */
  price: { intraday: string; base: string; name: string; unit: string; source: string };
  load: { code: string; name: string; source: string };
  mix: { source: string; groups: FuelGroup[] };
}

export const ZONES: PowerZone[] = [
  {
    id: "de",
    label: "Germany",
    price: {
      intraday: "smard.de_lu.price_da",
      base: "smard.de_lu.price_da_base",
      name: "DE-LU day-ahead base",
      unit: "€/MWh",
      source: "SMARD",
    },
    load: { code: "smard.de.load", name: "German grid load", source: "SMARD" },
    mix: {
      source: "SMARD",
      groups: [
        { name: "Lignite", color: 7, renewable: false, codes: ["smard.de.gen.lignite"] },
        { name: "Coal", color: 6, renewable: false, codes: ["smard.de.gen.hard_coal"] },
        { name: "Gas", color: 1, renewable: false, codes: ["smard.de.gen.gas"] },
        {
          name: "Wind",
          color: 0,
          renewable: true,
          codes: ["smard.de.gen.wind_onshore", "smard.de.gen.wind_offshore"],
        },
        { name: "Solar", color: 5, renewable: true, codes: ["smard.de.gen.solar"] },
        { name: "Hydro", color: 2, renewable: true, codes: ["smard.de.gen.hydro"] },
        {
          name: "Bioenergy",
          color: 8,
          renewable: true,
          codes: ["smard.de.gen.biomass", "smard.de.gen.other_renewables"],
        },
        {
          name: "Other",
          color: 3,
          renewable: false,
          codes: ["smard.de.gen.other_conventional", "smard.de.gen.pumped_storage"],
        },
      ],
    },
  },
  {
    id: "fr",
    label: "France",
    price: {
      intraday: "smard.fr.price_da",
      base: "smard.fr.price_da_base",
      name: "France day-ahead base",
      unit: "€/MWh",
      source: "SMARD",
    },
    load: { code: "odre.fr.load", name: "French consumption", source: "RTE éCO2mix" },
    mix: {
      source: "RTE éCO2mix",
      groups: [
        { name: "Nuclear", color: 4, renewable: false, codes: ["odre.fr.gen.nuclear"] },
        { name: "Coal", color: 6, renewable: false, codes: ["odre.fr.gen.coal"] },
        { name: "Gas", color: 1, renewable: false, codes: ["odre.fr.gen.gas"] },
        { name: "Wind", color: 0, renewable: true, codes: ["odre.fr.gen.wind"] },
        { name: "Solar", color: 5, renewable: true, codes: ["odre.fr.gen.solar"] },
        { name: "Hydro", color: 2, renewable: true, codes: ["odre.fr.gen.hydro"] },
        { name: "Bioenergy", color: 8, renewable: true, codes: ["odre.fr.gen.bioenergy"] },
        { name: "Other", color: 3, renewable: false, codes: ["odre.fr.gen.oil"] },
      ],
    },
  },
  {
    id: "gb",
    label: "Great Britain",
    price: {
      intraday: "elexon.gb.mid",
      base: "elexon.gb.mid_base",
      name: "GB market index (Elexon MID)",
      unit: "£/MWh",
      source: "Elexon",
    },
    load: { code: "elexon.gb.demand", name: "GB national demand", source: "Elexon" },
    mix: {
      source: "Elexon",
      groups: [
        { name: "Nuclear", color: 4, renewable: false, codes: ["elexon.gb.gen.nuclear"] },
        { name: "Coal", color: 6, renewable: false, codes: ["elexon.gb.gen.coal"] },
        {
          name: "Gas",
          color: 1,
          renewable: false,
          codes: ["elexon.gb.gen.gas_ccgt", "elexon.gb.gen.gas_ocgt"],
        },
        { name: "Wind", color: 0, renewable: true, codes: ["elexon.gb.gen.wind"] },
        { name: "Hydro", color: 2, renewable: true, codes: ["elexon.gb.gen.hydro"] },
        { name: "Bioenergy", color: 8, renewable: true, codes: ["elexon.gb.gen.biomass"] },
        {
          name: "Other",
          color: 3,
          renewable: false,
          codes: ["elexon.gb.gen.oil", "elexon.gb.gen.other", "elexon.gb.gen.pumped_storage"],
        },
      ],
    },
  },
];

export type ZoneId = PowerZone["id"];

/** Cross-border flows by neighbour. Interconnectors to the same country are added up. */
export const FLOWS: Partial<
  Record<ZoneId, { source: string; lines: { name: string; codes: string[] }[] }>
> = {
  fr: {
    source: "RTE éCO2mix",
    lines: [
      { name: "Great Britain", codes: ["odre.fr.exch.gb"] },
      { name: "Spain", codes: ["odre.fr.exch.es"] },
      { name: "Italy", codes: ["odre.fr.exch.it"] },
      { name: "Switzerland", codes: ["odre.fr.exch.ch"] },
      { name: "Germany & Belgium", codes: ["odre.fr.exch.de_be"] },
    ],
  },
  gb: {
    source: "Elexon",
    lines: [
      {
        name: "France",
        codes: ["elexon.gb.int.ifa", "elexon.gb.int.ifa2", "elexon.gb.int.eleclink"],
      },
      { name: "Netherlands", codes: ["elexon.gb.int.britned"] },
      { name: "Belgium", codes: ["elexon.gb.int.nemo"] },
      { name: "Norway", codes: ["elexon.gb.int.nsl"] },
      { name: "Denmark", codes: ["elexon.gb.int.viking"] },
      {
        name: "Ireland & N. Ireland",
        codes: ["elexon.gb.int.moyle", "elexon.gb.int.ewic", "elexon.gb.int.greenlink"],
      },
    ],
  },
};

export const TABS = [
  { id: "prices", label: "Prices & curve" },
  { id: "balance", label: "Balance & stocks" },
  { id: "flows", label: "Flows" },
  { id: "positioning", label: "Positioning" },
  { id: "gaps", label: "Data gaps" },
] as const;
export type PowerTab = (typeof TABS)[number]["id"];

/** URL parameters, checked against allow-lists (unknown values fall back to defaults). */
export function parsePowerParams(params: Record<string, string | string[] | undefined>): {
  tab: PowerTab;
  zone: PowerZone;
} {
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "prices";
  const zone = ZONES.find((z) => z.id === params.zone) ?? ZONES[0];
  return { tab, zone };
}

export function powerHref(tab: PowerTab, zone: ZoneId): string {
  const query = new URLSearchParams();
  if (zone !== "de") query.set("zone", zone);
  if (tab !== "prices") query.set("tab", tab);
  const text = query.toString();
  return text ? `/markets/power?${text}` : "/markets/power";
}
