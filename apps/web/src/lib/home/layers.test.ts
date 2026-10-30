import { describe, expect, it } from "vitest";

import type { Snapshot } from "@/lib/data/snapshot";

import {
  colorFor,
  countrySeries,
  homeHref,
  layerSeries,
  legend,
  metricText,
  metricValue,
  parseHomeParams,
} from "./layers";

const snap = (over: Partial<Snapshot>): Snapshot => ({
  code: "x",
  frequency: "daily",
  lastTs: "2026-10-28T00:00:00Z",
  lastValue: 74.9,
  prevTs: "2026-10-27T00:00:00Z",
  prevValue: 74.9,
  moveZ: 0.03,
  percentile5y: 62.8,
  historyCount: 1800,
  seasonalMean: 89.5,
  seasonalYears: 5,
  seasonalDeviationPct: -16.3,
  ...over,
});

describe("URL state", () => {
  it("falls back to defaults and rejects odd focus ids", () => {
    expect(parseHomeParams({ view: "mars", focus: "<script>" })).toEqual({
      view: "europe",
      layer: "storage",
      metric: "seasonal",
      focus: null,
    });
  });

  it("keeps only non-default parameters in links", () => {
    const state = parseHomeParams({});
    expect(homeHref(state)).toBe("/");
    expect(homeHref(state, { metric: "move", focus: "de" })).toBe("/?metric=move&focus=de");
  });
});

describe("country series per layer", () => {
  it("maps countries to the series that colour them", () => {
    expect(countrySeries("storage", "de")).toBe("agsi.de.full");
    expect(countrySeries("storage", "fi")).toBeNull(); // no storage in AGSI+
    expect(countrySeries("power", "lu")).toBe("smard.de_lu.price_da_base"); // DE-LU zone
    expect(countrySeries("power", "it")).toBeNull();
    expect(countrySeries("diesel", "gr")).toBe("ec_wob.gr.diesel.with_tax");
    expect(countrySeries("diesel", "gb")).toBeNull(); // not in the bulletin since 2020
  });

  it("lists each layer's series once", () => {
    expect(layerSeries("storage")).toHaveLength(18);
    expect(layerSeries("power")).toHaveLength(3);
    expect(layerSeries("diesel")).toHaveLength(27);
  });
});

describe("metrics and colours", () => {
  it("needs three prior years for a seasonal value", () => {
    expect(metricValue(snap({}), "seasonal")).toBe(-16.3);
    expect(metricValue(snap({ seasonalYears: 2 }), "seasonal")).toBeNull();
    expect(metricValue(undefined, "move")).toBeNull();
  });

  it("bins values symmetrically around zero", () => {
    expect(colorFor("seasonal", -16.3)).toBe("var(--map-div-n2)");
    expect(colorFor("seasonal", 4.9)).toBe("var(--map-div-0)");
    expect(colorFor("seasonal", 31)).toBe("var(--map-div-p3)");
    expect(colorFor("move", -1.2)).toBe("var(--map-div-n1)");
    expect(colorFor("percentile", 97.1)).toBe("var(--map-seq-5)");
    expect(colorFor("percentile", 0)).toBe("var(--map-seq-1)");
    expect(colorFor("move", null)).toBe("var(--map-nodata)");
  });

  it("has a legend entry for every colour plus no data", () => {
    expect(legend("seasonal")).toHaveLength(8);
    expect(legend("percentile").map((l) => l.label)).toEqual([
      "0–20",
      "20–40",
      "40–60",
      "60–80",
      "80–100",
      "No data",
    ]);
  });
});

describe("metricText", () => {
  it("puts the value in words", () => {
    expect(metricText("seasonal", -16.3)).toBe("−16.3% vs 5-year average");
    expect(metricText("move", 2.04)).toBe("+2.0σ latest move");
    expect(metricText("percentile", 97.1)).toBe("97th pct of 5 years");
    expect(metricText("move", null)).toBe("no data");
  });
});
