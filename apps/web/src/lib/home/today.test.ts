import { describe, expect, it } from "vitest";

import type { Snapshot } from "@/lib/data/snapshot";

import { todayInEnergy } from "./today";

const snap = (code: string, over: Partial<Snapshot>): Snapshot => ({
  code,
  frequency: "daily",
  lastTs: "2026-10-28T00:00:00Z",
  lastValue: 100,
  prevTs: "2026-10-27T00:00:00Z",
  prevValue: 100,
  moveZ: 0,
  percentile5y: 50,
  historyCount: 1000,
  seasonalMean: null,
  seasonalYears: 0,
  seasonalDeviationPct: null,
  ...over,
});

const units = new Map([
  ["eia.brent_spot", "$/bbl"],
  ["eia.wti_spot", "$/bbl"],
  ["eia.us_crude_stocks", "kb"],
  ["ec_wob.eu.diesel.with_tax", "€/1000 L"],
  ["agsi.eu.full", "%"],
]);

describe("todayInEnergy", () => {
  it("states EU storage first, then unusual moves, extremes and the storage outlier", () => {
    const snapshots = new Map([
      [
        "agsi.eu.full",
        snap("agsi.eu.full", { lastValue: 74.9, seasonalMean: 89.5, seasonalYears: 5 }),
      ],
      ["eia.wti_spot", snap("eia.wti_spot", { lastValue: 103.37, prevValue: 99.0, moveZ: 2.4 })],
      [
        "eia.brent_spot",
        snap("eia.brent_spot", {
          lastTs: "2026-10-27T00:00:00Z",
          lastValue: 123.1,
          percentile5y: 97.1,
        }),
      ],
      [
        "eia.us_crude_stocks",
        snap("eia.us_crude_stocks", { lastValue: 410625, percentile5y: 2.7 }),
      ],
    ]);
    const storage = [
      {
        name: "Latvia",
        snapshot: snap("agsi.lv.full", { lastValue: 49.8, seasonalMean: 81, seasonalYears: 5 }),
      },
      {
        name: "Poland",
        snapshot: snap("agsi.pl.full", { lastValue: 99.1, seasonalMean: 95, seasonalYears: 5 }),
      },
    ];
    const items = todayInEnergy({ snapshots, units, storage, rangeLabel: "2021–2025" });
    expect(items.map((i) => i.text)).toEqual([
      "EU gas storage is 74.9% full on 28 Oct 2026, 14.6 pts below the 2021–2025 average for the date.",
      "WTI spot rose 4.37 $/bbl to 103.37 $/bbl on 28 Oct 2026, an unusually large move (2.4 standard deviations of the past year's changes).",
      // Most extreme first: 2.7 is 47.3 points from the median, 97.1 is 47.1.
      "US commercial crude stocks are 410.6 mb (28 Oct 2026), lower than 97% of the past five years' values.",
      "Brent spot is 123.10 $/bbl (27 Oct 2026), higher than 97% of the past five years' values.",
      "Of 2 EU countries with storage data, Latvia is furthest from normal: 49.8% full on 28 Oct 2026, 31.2 pts below its 2021–2025 average for the date.",
    ]);
    expect(items[1].href).toBe("/markets/crude");
  });

  it("says nothing it has no data for", () => {
    expect(
      todayInEnergy({ snapshots: new Map(), units, storage: [], rangeLabel: "2021–2025" }),
    ).toEqual([]);
  });

  it("does not repeat a series named for its move as an extreme", () => {
    const snapshots = new Map([
      ["eia.brent_spot", snap("eia.brent_spot", { moveZ: -3, prevValue: 110, percentile5y: 99 })],
    ]);
    const items = todayInEnergy({ snapshots, units, storage: [], rangeLabel: "2021–2025" });
    expect(items).toHaveLength(1);
    expect(items[0].text).toContain("fell 10.00 $/bbl");
  });
});
