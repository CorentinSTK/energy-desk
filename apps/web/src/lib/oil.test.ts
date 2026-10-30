import { describe, expect, it } from "vitest";

import type { Points } from "@/lib/data/series";

import {
  curveRelativeToFront,
  dateOnOrBefore,
  isoDaysBefore,
  netPosition,
  percentOf,
  pumpPrice,
} from "./oil";

const D = (day: number) => `2026-10-${String(day).padStart(2, "0")}T00:00:00Z`;

describe("isoDaysBefore", () => {
  it("keeps the stored timestamp format", () => {
    expect(isoDaysBefore(D(29), 7)).toBe(D(22));
  });
});

describe("dateOnOrBefore", () => {
  const points: Points = [
    [D(16), 1],
    [D(19), 2],
    [D(22), 3],
  ];

  it("takes the latest trading day at or before the target", () => {
    expect(dateOnOrBefore(points, D(22), 4)).toBe(D(22));
    expect(dateOnOrBefore(points, D(21), 4)).toBe(D(19));
  });

  it("gives nothing when the nearest value is too old", () => {
    expect(dateOnOrBefore(points, D(15), 4)).toBeNull();
    expect(dateOnOrBefore(points, D(25), 2)).toBeNull();
  });
});

describe("curveRelativeToFront", () => {
  it("turns stored M1 − Mn spreads into a curve starting at zero", () => {
    const m2: Points = [[D(29), 1.95]];
    const m3: Points = [[D(29), 4.09]];
    expect(curveRelativeToFront([m2, m3], D(29))).toEqual([0, -1.95, -4.09]);
  });

  it("keeps a missing tenor as a gap and gives null when the date has no spread", () => {
    const m2: Points = [[D(29), 1.95]];
    const m3: Points = [[D(28), 4.0]];
    expect(curveRelativeToFront([m2, m3], D(29))).toEqual([0, -1.95, null]);
    expect(curveRelativeToFront([m2, m3], D(27))).toBeNull();
  });
});

describe("positioning", () => {
  const long: Points = [
    [D(13), 160000],
    [D(20), 163413],
  ];
  const short: Points = [[D(20), 127226]];

  it("nets long and short on report dates both have", () => {
    expect(netPosition(long, short)).toEqual([[D(20), 36187]]);
  });

  it("expresses the net as a share of open interest", () => {
    const share = percentOf([[D(20), 36187]], [[D(20), 1835144]]);
    expect(share[0][1]).toBeCloseTo(1.972, 3);
  });
});

describe("pumpPrice", () => {
  it("splits the latest price into price before taxes and taxes, same bulletin", () => {
    const price = pumpPrice("Germany", [[D(26), 2298]], [[D(26), 1439.29]]);
    expect(price?.taxes).toBeCloseTo(858.71);
    expect(price?.taxShare).toBeCloseTo(37.37, 2);
  });

  it("gives no split when the two prices are from different bulletins", () => {
    expect(pumpPrice("Germany", [[D(26), 2298]], [[D(19), 1430]])).toBeNull();
  });
});
