import "server-only";

export const TABS = [
  { id: "prices", label: "Prices & curve" },
  { id: "balance", label: "Balance & stocks" },
  { id: "flows", label: "Flows" },
  { id: "positioning", label: "Positioning" },
  { id: "gaps", label: "Data gaps" },
] as const;
export type Tab = (typeof TABS)[number]["id"];

/** EU pump prices (EC Weekly Oil Bulletin): `product` is the catalogue key (ec_wob.<area>.<product>.*). */
export const FUELS = [
  { id: "diesel", label: "Diesel", product: "diesel", noun: "diesel" },
  { id: "petrol", label: "Petrol (Euro-super 95)", product: "euro95", noun: "petrol" },
] as const;
export type Fuel = (typeof FUELS)[number];

/**
 * Areas of the Weekly Oil Bulletin, EU and euro-area averages first. Names come from the catalogue
 * (`region`), so they are written once, in worker/scripts/gen_ec_wob_catalog.py.
 */
export const BULLETIN_AREAS = [
  "eu",
  "eur",
  "at",
  "be",
  "bg",
  "cy",
  "cz",
  "de",
  "dk",
  "ee",
  "es",
  "fi",
  "fr",
  "gr",
  "hr",
  "hu",
  "ie",
  "it",
  "lt",
  "lu",
  "lv",
  "mt",
  "nl",
  "pl",
  "pt",
  "ro",
  "se",
  "si",
  "sk",
] as const;
export const AVERAGES = new Set<string>(["eu", "eur"]);

/** URL parameters, checked against allow-lists (unknown values fall back to defaults). */
export function parseProductsParams(params: Record<string, string | string[] | undefined>): {
  tab: Tab;
  fuel: Fuel;
} {
  const tab = TABS.find((t) => t.id === params.tab)?.id ?? "prices";
  const fuel = FUELS.find((f) => f.id === params.fuel) ?? FUELS[0];
  return { tab, fuel };
}

export function productsHref(tab: Tab, fuel: Fuel["id"] = "diesel"): string {
  const query = new URLSearchParams();
  if (tab !== "prices") query.set("tab", tab);
  if (fuel !== "diesel") query.set("fuel", fuel);
  const text = query.toString();
  return text ? `/markets/products?${text}` : "/markets/products";
}
