import "server-only";

/** Countries with storage series (catalog/gie_agsi.yaml), EU aggregate first. */
export const STORAGE_AREAS = [
  { id: "eu", label: "EU" },
  { id: "de", label: "Germany" },
  { id: "fr", label: "France" },
  { id: "nl", label: "Netherlands" },
  { id: "it", label: "Italy" },
  { id: "at", label: "Austria" },
] as const;
export type StorageArea = (typeof STORAGE_AREAS)[number]["id"];

/** Entry points with flow series (catalog/entsog.yaml), grouped by origin for the legend order. */
export const ENTRY_POINTS = [
  "entsog.dunkerque",
  "entsog.zeebrugge_zpt",
  "entsog.mazara",
  "entsog.almeria",
  "entsog.gela",
  "entsog.melendugno",
  "entsog.strandzha2",
  "entsog.zeebrugge_izt",
  "entsog.bacton_bbl",
] as const;

export const TABS = [
  { id: "prices", label: "Prices & curve" },
  { id: "storage", label: "Balance & stocks" },
  { id: "flows", label: "Flows" },
  { id: "positioning", label: "Positioning" },
  { id: "gaps", label: "Data gaps" },
] as const;
export type GasTab = (typeof TABS)[number]["id"];

/** URL parameters, checked against allow-lists (unknown values fall back to defaults). */
export function parseGasParams(params: Record<string, string | string[] | undefined>): {
  tab: GasTab;
  area: StorageArea;
} {
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "prices";
  const area = STORAGE_AREAS.find((a) => a.id === params.area)?.id ?? "eu";
  return { tab, area };
}

export function gasHref(tab: GasTab, area: StorageArea): string {
  const query = new URLSearchParams();
  if (tab !== "prices") query.set("tab", tab);
  if (area !== "eu") query.set("area", area);
  const text = query.toString();
  return text ? `/markets/gas?${text}` : "/markets/gas";
}
