import { describe, expect, it } from "vitest";

import type { CatalogSeries } from "@/lib/data/catalog";

import { summariseSources } from "./sources";

const series = (over: Partial<CatalogSeries>): CatalogSeries => ({
  code: "x",
  name: "x",
  commodity: "crude",
  region: "US",
  unit: "$/bbl",
  frequency: "daily",
  source: "eia",
  sourceRef: "x",
  description: "",
  isUnofficial: false,
  priceKind: null,
  license: "U.S. EIA — public domain",
  licenseUrl: "https://www.eia.gov/about/copyrights_reuse.php",
  attribution: "Source: U.S. Energy Information Administration.",
  publicationLagDays: 0,
  observationCount: 1,
  firstObservation: null,
  lastObservation: null,
  gapCount: 0,
  largestIntervalDays: null,
  ...over,
});

describe("summariseSources", () => {
  it("groups series by source with their distinct licences and attributions", () => {
    const summary = summariseSources(
      [
        series({ code: "a" }),
        series({
          code: "b",
          license: "EIA spot (Refinitiv)",
          attribution: "Source: EIA (Refinitiv).",
        }),
        series({
          code: "c",
          source: "entsog",
          license: "ENTSOG TP terms",
          attribution: "ENTSOG TP [{extraction_date}]",
        }),
        series({ code: "d", source: "yahoo", isUnofficial: true }),
      ],
      { entsog: "30-10-2026" },
    );
    expect(summary.map((s) => s.label)).toEqual(["EIA", "ENTSOG", "Yahoo Finance"]);
    expect(summary[0].series).toBe(2);
    expect(summary[0].licences).toHaveLength(2);
    expect(summary[1].attributions).toEqual(["ENTSOG TP [30-10-2026]"]);
    expect(summary[2].unofficial).toBe(true);
  });
});
