import { describe, expect, it } from "vitest";

import { differenceOnDates, shareOnDates, sumOnDates } from "./points";

const D1 = "2026-10-26T00:00:00Z";
const D2 = "2026-10-27T00:00:00Z";
const D3 = "2026-10-28T00:00:00Z";

describe("sumOnDates", () => {
  it("adds series that all reported", () => {
    expect(
      sumOnDates([
        [
          [D1, 1],
          [D2, 2],
        ],
        [
          [D1, 10],
          [D2, 20],
        ],
      ]),
    ).toEqual([
      [D1, 11],
      [D2, 22],
    ]);
  });

  it("drops a date where a started series is missing, including its latest unpublished day", () => {
    const a: [string, number][] = [
      [D1, 1],
      [D2, 2],
      [D3, 3],
    ];
    const b: [string, number][] = [
      [D1, 10],
      [D3, 30],
    ];
    const late: [string, number][] = [
      [D1, 100],
      [D2, 200],
    ];
    expect(sumOnDates([a, b])).toEqual([
      [D1, 11],
      [D3, 33],
    ]);
    expect(sumOnDates([a, late])).toEqual([
      [D1, 101],
      [D2, 202],
    ]);
  });

  it("counts a series as zero before it started, and ignores empty series", () => {
    const old: [string, number][] = [
      [D1, 1],
      [D2, 2],
    ];
    const recent: [string, number][] = [[D2, 5]];
    expect(sumOnDates([old, recent, []])).toEqual([
      [D1, 1],
      [D2, 7],
    ]);
    expect(sumOnDates([[], []])).toEqual([]);
  });
});

describe("shareOnDates", () => {
  it("is a percentage on common dates, skipping a zero total", () => {
    expect(
      shareOnDates(
        [
          [D1, 25],
          [D2, 5],
          [D3, 1],
        ],
        [
          [D1, 100],
          [D2, 0],
        ],
      ),
    ).toEqual([[D1, 25]]);
  });
});

describe("differenceOnDates", () => {
  it("subtracts on common dates only", () => {
    expect(
      differenceOnDates(
        [
          [D1, 80],
          [D2, 90],
        ],
        [
          [D2, 70],
          [D3, 60],
        ],
      ),
    ).toEqual([[D2, 20]]);
  });
});
