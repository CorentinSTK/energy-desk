import "server-only";

/** Areas with LNG series (catalog/gie_alsi.yaml), EU aggregate first. */
export const LNG_AREAS = [
  { id: "eu", label: "EU" },
  { id: "es", label: "Spain" },
  { id: "fr", label: "France" },
  { id: "it", label: "Italy" },
  { id: "nl", label: "Netherlands" },
  { id: "be", label: "Belgium" },
  { id: "de", label: "Germany" },
] as const;
export type LngArea = (typeof LNG_AREAS)[number]["id"];

/** Same tabs as every market page (BUILD_SPEC §3); uncovered ones explain the gap. */
export const TABS = [
  { id: "prices", label: "Prices & curve" },
  { id: "terminals", label: "Balance & stocks" },
  { id: "flows", label: "Flows" },
  { id: "positioning", label: "Positioning" },
  { id: "gaps", label: "Data gaps" },
] as const;
export type LngTab = (typeof TABS)[number]["id"];

export function parseLngParams(params: Record<string, string | string[] | undefined>): {
  tab: LngTab;
  area: LngArea;
} {
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "terminals";
  const area = LNG_AREAS.find((a) => a.id === params.area)?.id ?? "eu";
  return { tab, area };
}

export function lngHref(tab: LngTab, area: LngArea): string {
  const query = new URLSearchParams();
  if (tab !== "terminals") query.set("tab", tab);
  if (area !== "eu") query.set("area", area);
  const text = query.toString();
  return text ? `/markets/lng?${text}` : "/markets/lng";
}
