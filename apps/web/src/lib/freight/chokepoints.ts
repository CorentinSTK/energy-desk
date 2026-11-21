/**
 * The eight chokepoints ingested from IMF PortWatch (worker/catalog/portwatch.yaml), in the order the
 * freight page lists them: the oil and LNG routes out of the Gulf first, then the alternatives.
 */

export const CHOKEPOINTS = [
  { id: "hormuz", label: "Strait of Hormuz", portwatchId: "chokepoint6" },
  { id: "bab_el_mandeb", label: "Bab el-Mandeb", portwatchId: "chokepoint4" },
  { id: "suez", label: "Suez Canal", portwatchId: "chokepoint1" },
  { id: "cape", label: "Cape of Good Hope", portwatchId: "chokepoint7" },
  { id: "malacca", label: "Strait of Malacca", portwatchId: "chokepoint5" },
  { id: "panama", label: "Panama Canal", portwatchId: "chokepoint2" },
  { id: "bosporus", label: "Bosporus", portwatchId: "chokepoint3" },
  { id: "gibraltar", label: "Strait of Gibraltar", portwatchId: "chokepoint8" },
] as const;

export type ChokepointId = (typeof CHOKEPOINTS)[number]["id"];
export type TransitSeries = "transits" | "tanker_transits" | "tanker_tonnes";

export function transitCode(id: ChokepointId, series: TransitSeries): string {
  return `portwatch.${id}.${series}`;
}

export function chokepointLabel(portwatchId: string): string | undefined {
  return CHOKEPOINTS.find((c) => c.portwatchId === portwatchId)?.label;
}

export const PORTWATCH_SOURCE = "IMF PortWatch";
