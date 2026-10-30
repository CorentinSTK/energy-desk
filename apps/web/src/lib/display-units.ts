/**
 * Display rescaling between SI prefixes of the same unit (kWh/d → GWh/d), so large source values are
 * readable. Values are stored in the source unit; this is not a unit conversion (energy ↔ volume,
 * currency…), which is done only by the worker's units module (CLAUDE.md).
 */

const RESCALE: Record<string, { unit: string; factor: number }> = {
  "kWh/d": { unit: "GWh/d", factor: 1e-6 },
  MW: { unit: "GW", factor: 1e-3 },
  // Oil stocks: thousand → million barrels.
  kb: { unit: "mb", factor: 1e-3 },
  // EC Weekly Oil Bulletin: euros per 1,000 litres → per litre, as shown at the pump.
  "€/1000 L": { unit: "€/L", factor: 1e-3 },
};

export function displayUnit(sourceUnit: string): { unit: string; factor: number } {
  return RESCALE[sourceUnit] ?? { unit: sourceUnit, factor: 1 };
}

export function rescale<T extends [string, number]>(points: T[], sourceUnit: string): T[] {
  const { factor } = displayUnit(sourceUnit);
  return factor === 1 ? points : (points.map(([ts, v]) => [ts, v * factor]) as T[]);
}
