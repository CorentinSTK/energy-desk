import "server-only";

import { CHOKEPOINTS, type ChokepointId } from "@/lib/freight/chokepoints";

export const TABS = [
  { id: "chokepoints", label: "Chokepoints" },
  { id: "routes", label: "Routes & voyage times" },
  { id: "gaps", label: "Freight rates & gaps" },
] as const;
export type FreightTab = (typeof TABS)[number]["id"];

export function parseFreightParams(params: Record<string, string | string[] | undefined>): {
  tab: FreightTab;
  strait: ChokepointId;
} {
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "chokepoints";
  const strait = CHOKEPOINTS.find((c) => c.id === params.strait)?.id ?? "hormuz";
  return { tab, strait };
}

export function freightHref(tab: FreightTab, strait: ChokepointId): string {
  const query = new URLSearchParams();
  if (tab !== "chokepoints") query.set("tab", tab);
  if (strait !== "hormuz") query.set("strait", strait);
  const text = query.toString();
  return text ? `/markets/freight?${text}` : "/markets/freight";
}
