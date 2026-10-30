import "server-only";

export const TABS = [
  { id: "prices", label: "Prices & curve" },
  { id: "balance", label: "Balance & stocks" },
  { id: "flows", label: "Flows" },
  { id: "positioning", label: "Positioning" },
  { id: "gaps", label: "Data gaps" },
] as const;
export type Tab = (typeof TABS)[number]["id"];

/** URL parameter, checked against the allow-list (unknown values fall back to the default). */
export function parseTab(params: Record<string, string | string[] | undefined>): Tab {
  return TABS.find((t) => t.id === params.tab)?.id ?? "prices";
}

export function tabHref(tab: Tab): string {
  return tab === "prices" ? "/markets/crude" : `/markets/crude?tab=${tab}`;
}
