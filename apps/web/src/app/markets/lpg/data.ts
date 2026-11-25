import "server-only";

export const TABS = [
  { id: "prices", label: "Prices" },
  { id: "balance", label: "Balance & stocks" },
  { id: "flows", label: "Flows" },
  { id: "positioning", label: "Positioning" },
  { id: "gaps", label: "Data gaps" },
] as const;
export type Tab = (typeof TABS)[number]["id"];

/** URL parameters, checked against an allow-list (unknown values fall back to the default). */
export function parseLpgParams(params: Record<string, string | string[] | undefined>): {
  tab: Tab;
} {
  return { tab: TABS.find((t) => t.id === params.tab)?.id ?? "prices" };
}

export function lpgHref(tab: Tab): string {
  return tab === "prices" ? "/markets/lpg" : `/markets/lpg?tab=${tab}`;
}
