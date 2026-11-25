/**
 * One colour per commodity, used identically everywhere (BUILD_SPEC §2.6).
 * Class names are written out in full so Tailwind can find them when scanning the source.
 */

export type Commodity = "crude" | "products" | "natgas" | "lng" | "lpg" | "power" | "freight";

interface CommodityStyle {
  label: string;
  /** CSS variable holding the colour, for charts and inline styles. */
  cssVar: string;
  textClass: string;
  bgClass: string;
}

export const COMMODITIES: Record<Commodity, CommodityStyle> = {
  crude: { label: "Crude oil", cssVar: "--c-crude", textClass: "text-crude", bgClass: "bg-crude" },
  products: {
    label: "Refined products",
    cssVar: "--c-products",
    textClass: "text-products",
    bgClass: "bg-products",
  },
  natgas: {
    label: "Natural gas",
    cssVar: "--c-natgas",
    textClass: "text-natgas",
    bgClass: "bg-natgas",
  },
  lng: { label: "LNG", cssVar: "--c-lng", textClass: "text-lng", bgClass: "bg-lng" },
  lpg: { label: "LPG", cssVar: "--c-lpg", textClass: "text-lpg", bgClass: "bg-lpg" },
  power: { label: "Power", cssVar: "--c-power", textClass: "text-power", bgClass: "bg-power" },
  freight: {
    label: "Freight & shipping",
    cssVar: "--c-freight",
    textClass: "text-freight",
    bgClass: "bg-freight",
  },
};

const MARKET_PAGES: Record<string, Commodity> = {
  crude: "crude",
  products: "products",
  gas: "natgas",
  lng: "lng",
  lpg: "lpg",
  power: "power",
  freight: "freight",
};

/** The commodity of a market page link ("/markets/gas?tab=storage" → natgas); null otherwise. */
export function commodityOfHref(href: string): Commodity | null {
  const page = /^\/markets\/([a-z]+)/.exec(href)?.[1];
  return page ? (MARKET_PAGES[page] ?? null) : null;
}
