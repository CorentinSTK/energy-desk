/**
 * Who carries what: the main vessel classes of each seaborne energy commodity, largest first.
 *
 * Reference data, not market data: typical cargo capacities quoted from public pages (EIA "Today in
 * Energy" articles, Wikipedia), each with its source. Capacities stay in the source's unit (barrels
 * for oil tankers, cubic metres for gas carriers); classes are compared only within one commodity.
 * No class is listed without a source, and no share of trade by class is shown: that needs paid
 * vessel-tracking data (a declared gap).
 */

export type VesselCommodity = "crude" | "products" | "lng" | "lpg";
export type HullShape = "tanker" | "membrane" | "gas";

export interface Source {
  label: string;
  url: string;
}

export interface VesselClass {
  id: string;
  name: string;
  /** Cargo capacity range in `unit`; low equals high for a single "about" figure. */
  low: number;
  high: number;
  /** True when the source gives an approximate single figure ("around 1 million barrels"). */
  approx?: boolean;
  /** One sentence from the sources: role, route or constraint. */
  note: string;
  sources: Source[];
}

export interface CommodityFleet {
  id: VesselCommodity;
  label: string;
  /** Unit of every capacity in the group, as written in the sources. */
  unit: string;
  shape: HullShape;
  classes: VesselClass[];
}

const EIA_AFRA: Source = {
  label: "EIA, Oil tanker sizes on the AFRA scale (2014)",
  url: "https://www.eia.gov/todayinenergy/detail.php?id=17991",
};
const EIA_GULF: Source = {
  label: "EIA, U.S. Gulf Coast port limitations (2018)",
  url: "https://www.eia.gov/todayinenergy/detail.php?id=36232",
};
const EIA_RATES: Source = {
  label: "EIA, Crude oil tanker rates (2026)",
  url: "https://www.eia.gov/todayinenergy/detail.php?id=67064",
};

export const FLEETS: CommodityFleet[] = [
  {
    id: "crude",
    label: "Crude oil",
    unit: "barrels of crude",
    shape: "tanker",
    classes: [
      {
        id: "vlcc",
        name: "VLCC",
        low: 1_900_000,
        high: 2_200_000,
        note: "Long-haul routes. U.S. Gulf Coast onshore ports cannot load one fully; the offshore LOOP is the only U.S. facility that can.",
        sources: [EIA_RATES, EIA_GULF],
      },
      {
        id: "suezmax",
        name: "Suezmax",
        low: 1_000_000,
        high: 1_000_000,
        approx: true,
        note: "Medium-length routes; the largest class that can transit the Suez Canal.",
        sources: [EIA_RATES],
      },
      {
        id: "aframax",
        name: "Aframax",
        low: 500_000,
        high: 500_000,
        approx: true,
        note: "80,000 to 120,000 deadweight tons; a trade name, not an official AFRA class. Four carry what one VLCC does.",
        sources: [EIA_GULF, EIA_AFRA],
      },
    ],
  },
  {
    id: "products",
    label: "Refined products",
    unit: "barrels of gasoline",
    shape: "tanker",
    classes: [
      {
        id: "lr1",
        name: "Long Range 1 (LR1)",
        low: 345_000,
        high: 615_000,
        note: "Also used for light sweet crude (310,000 to 550,000 barrels).",
        sources: [EIA_AFRA],
      },
      {
        id: "mr",
        name: "Medium Range (MR)",
        low: 190_000,
        high: 345_000,
        note: "Between General Purpose and LR1 on the AFRA scale.",
        sources: [EIA_AFRA],
      },
      {
        id: "gp",
        name: "General Purpose (GP)",
        low: 70_000,
        high: 190_000,
        note: "The smallest class on the AFRA scale; smaller ships can access most ports.",
        sources: [EIA_AFRA],
      },
    ],
  },
  {
    id: "lng",
    label: "LNG",
    unit: "m³ of LNG",
    shape: "membrane",
    classes: [
      {
        id: "qmax",
        name: "Q-Max",
        low: 266_000,
        high: 266_000,
        note: "The largest LNG carriers: 345 m long and 53.8 m wide.",
        sources: [{ label: "Wikipedia, Q-Max", url: "https://en.wikipedia.org/wiki/Q-Max" }],
      },
      {
        id: "qflex",
        name: "Q-Flex",
        low: 165_000,
        high: 216_000,
        note: "Between conventional carriers and the Q-Max in size.",
        sources: [{ label: "Wikipedia, Q-Flex", url: "https://en.wikipedia.org/wiki/Q-Flex" }],
      },
      {
        id: "conventional",
        name: "Conventional",
        low: 170_000,
        high: 170_000,
        approx: true,
        note: "Carrier sizes have grown to about 170,000 m³; older Moss-type ships with spherical tanks carry around 135,000 m³.",
        sources: [
          { label: "Wikipedia, LNG carrier", url: "https://en.wikipedia.org/wiki/LNG_carrier" },
        ],
      },
    ],
  },
  {
    id: "lpg",
    label: "LPG",
    unit: "m³ of LPG",
    shape: "gas",
    classes: [
      {
        id: "vlgc",
        name: "VLGC",
        low: 50_000,
        high: 80_000,
        note: "Very Large Gas Carrier, fully refrigerated; fully refrigerated gas carriers range from 20,000 to 100,000 m³.",
        sources: [
          { label: "Wikipedia, Gas carrier", url: "https://en.wikipedia.org/wiki/Gas_carrier" },
        ],
      },
    ],
  },
];

/** Smallest drawn size, so a small class stays visible next to a large one. */
export const MIN_RELATIVE_SIZE = 0.35;

/** Drawn length of a class relative to the largest of its group (by top capacity), 0.35 to 1. */
export function relativeSize(fleet: CommodityFleet, vessel: VesselClass): number {
  const largest = Math.max(...fleet.classes.map((c) => c.high));
  return Math.max(MIN_RELATIVE_SIZE, vessel.high / largest);
}

function amount(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)} million`;
  }
  return new Intl.NumberFormat("en-GB").format(value);
}

/** "1.9–2.2 million", "about 1 million", "345,000–615,000". */
export function formatCapacity(vessel: VesselClass): string {
  if (vessel.low === vessel.high) {
    return `${vessel.approx ? "about " : ""}${amount(vessel.high)}`;
  }
  const bothMillions = vessel.low >= 1_000_000 && vessel.high >= 1_000_000;
  if (bothMillions) {
    const low = amount(vessel.low).replace(" million", "");
    return `${low}–${amount(vessel.high)}`;
  }
  return `${amount(vessel.low)}–${amount(vessel.high)}`;
}
