import { describe, expect, it } from "vitest";

import type { CatalogSeries } from "./catalog";
import { chartInfo } from "./chart-info";

const NOW = new Date("2026-10-29T12:00:00Z");

function series(overrides: Partial<CatalogSeries>): CatalogSeries {
  return {
    code: "elexon.gb.demand",
    name: "GB national demand (INDO)",
    commodity: "power",
    region: "GB",
    unit: "MW",
    frequency: "daily",
    source: "elexon",
    sourceRef: "demand|initialDemandOutturn",
    description: "",
    isUnofficial: false,
    priceKind: null,
    license: "Elexon BMRS data licence",
    licenseUrl: "https://example.org/bmrs-licence",
    attribution: "Contains BMRS data © Elexon Limited copyright and database right 2026.",
    publicationLagDays: 1,
    observationCount: 10,
    firstObservation: "2026-10-19T00:00:00Z",
    lastObservation: "2026-10-28T00:00:00Z",
    gapCount: 0,
    largestIntervalDays: 1,
    ...overrides,
  };
}

describe("chartInfo", () => {
  it("links the licence next to the attribution, with the display unit", () => {
    const info = chartInfo([series({})], {}, NOW, { source: "Elexon", unit: "GW" });
    expect(info.licenseUrl).toBe("https://example.org/bmrs-licence");
    expect(info.unit).toBe("GW");
    expect(info.source).toBe("Elexon");
  });

  it("gives no single link when series have different licences or no attribution", () => {
    const mixed = chartInfo(
      [series({}), series({ code: "other", licenseUrl: "https://example.org/other" })],
      {},
      NOW,
      { source: "x", unit: "GW" },
    );
    expect(mixed.licenseUrl).toBeUndefined();
    const none = chartInfo([series({ attribution: null })], {}, NOW, { source: "x", unit: "GW" });
    expect(none.licenseUrl).toBeUndefined();
  });

  it("falls back when the series is not in the catalogue", () => {
    expect(chartInfo([], {}, NOW, { source: "SMARD", unit: "€/MWh" })).toEqual({
      source: "SMARD",
      unit: "€/MWh",
    });
  });
});
