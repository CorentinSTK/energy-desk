import { describe, expect, it } from "vitest";

import type { ChartTokens } from "./chart-tokens";
import {
  bandHeights,
  dayLabel,
  multiLineOption,
  seasonalOption,
  timeSeriesOption,
} from "./options";

const tokens: ChartTokens = {
  text: "#000000",
  textSecondary: "#111111",
  axis: "#222222",
  grid: "#333333",
  band: "rgba(0, 0, 0, 0.1)",
  average: "#444444",
  surface: "#ffffff",
  border: "#555555",
  fontFamily: "Inter",
  series: ["#010101", "#020202"],
  commodity: {
    crude: "#aa0000",
    products: "#bb0000",
    natgas: "#cc0000",
    lng: "#dd0000",
    lpg: "#ee0000",
    power: "#ff0000",
  },
};

type Series = { name: string; data: unknown[]; connectNulls?: boolean; stack?: string };

describe("timeSeriesOption", () => {
  const option = timeSeriesOption(tokens, {
    name: "Demo",
    color: "#aa0000",
    data: [
      ["2026-01-01", 1],
      ["2026-01-02", null],
      ["2026-01-03", 3],
    ],
    unit: "$/bbl",
    decimals: 2,
  });
  const series = option.series as Series[];

  it("keeps missing observations as gaps", () => {
    expect(series[0].data[1]).toEqual(["2026-01-02", null]);
    expect(series[0].connectNulls).toBe(false);
  });

  it("uses a single y-axis", () => {
    expect(Array.isArray(option.yAxis)).toBe(false);
  });
});

describe("bandHeights", () => {
  it("is max − min, and null where a bound is missing", () => {
    expect(bandHeights([1, 2, null], [4, 2, 5])).toEqual([3, 0, null]);
  });
});

describe("seasonalOption", () => {
  const option = seasonalOption(tokens, {
    periods: ["W1", "W2"],
    min: [1, 2],
    max: [5, 6],
    average: [3, 4],
    current: [3.5, null],
    currentLabel: "2026",
    rangeLabel: "2021–2025",
    color: "#aa0000",
    unit: "TWh",
    decimals: 1,
  });
  const series = option.series as Series[];

  it("draws band base, band, average and current year", () => {
    expect(series.map((s) => s.name)).toEqual([
      "band-base",
      "2021–2025 range",
      "2021–2025 avg",
      "2026",
    ]);
  });

  it("stacks the band on its minimum", () => {
    expect(series[0].stack).toBe(series[1].stack);
    expect(series[1].data).toEqual([4, 4]);
  });

  it("does not connect the current year across missing weeks", () => {
    expect(series[3].connectNulls).toBe(false);
  });
});

describe("dayLabel", () => {
  it("formats a calendar day", () => {
    expect(dayLabel("2001-03-01")).toBe("1 Mar");
  });
});

describe("multiLineOption", () => {
  it("keeps one series per line, gaps included, with the categorical palette", () => {
    const option = multiLineOption(tokens, {
      series: [
        {
          name: "A",
          data: [
            ["2026-01-01", 1],
            ["2026-01-02", null],
          ],
        },
        { name: "B", data: [["2026-01-01", 2]] },
      ],
      unit: "GWh/d",
      decimals: 0,
    });
    const series = option.series as Series[];
    expect(series.map((x) => x.name)).toEqual(["A", "B"]);
    expect(series[0].connectNulls).toBe(false);
    expect(option.color).toEqual(["#010101", "#020202"]);
  });
});
