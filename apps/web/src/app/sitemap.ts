import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/** Public pages only; the style guide is excluded (and disallowed in robots.ts). */
const PATHS = [
  "",
  "/markets/gas",
  "/markets/lng",
  "/markets/power",
  "/markets/crude",
  "/markets/products",
  "/forecasts",
  "/data",
  "/methodology",
  "/about",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${SITE_URL}${path}` }));
}
