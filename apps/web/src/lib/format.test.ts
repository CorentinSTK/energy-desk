import { describe, expect, it } from "vitest";

import {
  MISSING,
  decimalsFor,
  formatChange,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercentChange,
  formatPercentile,
} from "./format";

describe("formatNumber", () => {
  it("groups thousands and fixes precision", () => {
    expect(formatNumber(1234.5, 2)).toBe("1,234.50");
    expect(formatNumber(1234567, 0)).toBe("1,234,567");
  });

  it("uses a typographic minus for negatives", () => {
    expect(formatNumber(-3.14159, 2)).toBe("−3.14");
  });

  it("does not show a minus when the value rounds to zero", () => {
    expect(formatNumber(-0.001, 2)).toBe("0.00");
  });

  it("renders missing values as an em dash", () => {
    expect(formatNumber(null)).toBe(MISSING);
    expect(formatNumber(undefined)).toBe(MISSING);
    expect(formatNumber(Number.NaN)).toBe(MISSING);
  });
});

describe("formatChange", () => {
  it("always shows the sign", () => {
    expect(formatChange(1.2, 2)).toBe("+1.20");
    expect(formatChange(-0.4, 2)).toBe("−0.40");
  });

  it("shows no sign for zero after rounding", () => {
    expect(formatChange(0.004, 2)).toBe("0.00");
  });
});

describe("formatPercentChange", () => {
  it("adds a percent sign to a signed change in percent points", () => {
    expect(formatPercentChange(-18.24)).toBe("−18.2%");
    expect(formatPercentChange(null)).toBe(MISSING);
  });
});

describe("formatPercentile", () => {
  it.each([
    [1, "1st pct"],
    [2, "2nd pct"],
    [3, "3rd pct"],
    [11, "11th pct"],
    [12, "12th pct"],
    [13, "13th pct"],
    [21, "21st pct"],
    [92, "92nd pct"],
    [100, "100th pct"],
  ])("%d → %s", (input, expected) => {
    expect(formatPercentile(input)).toBe(expected);
  });

  it("clamps and rounds", () => {
    expect(formatPercentile(91.6)).toBe("92nd pct");
    expect(formatPercentile(140)).toBe("100th pct");
  });
});

describe("formatDateTime", () => {
  it("shows the time in the market's zone, clock changes included", () => {
    expect(formatDateTime("2026-10-26T13:00:00Z", "Europe/Berlin")).toBe("26 Oct 2026, 14:00 CET");
    expect(formatDateTime("2026-07-01T13:00:00Z", "Europe/London")).toBe("1 Jul 2026, 14:00 BST");
    expect(formatDateTime(null, "Europe/Paris")).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats in UTC as day, short month, year", () => {
    expect(formatDate("2026-10-28T23:30:00Z")).toBe("28 Oct 2026");
  });

  it("handles invalid input", () => {
    expect(formatDate("not a date")).toBe(MISSING);
  });
});

describe("decimalsFor", () => {
  it("uses unit conventions", () => {
    expect(decimalsFor("$/MMBtu")).toBe(3);
    expect(decimalsFor("TWh")).toBe(1);
    expect(decimalsFor("unknown")).toBe(2);
  });
});
