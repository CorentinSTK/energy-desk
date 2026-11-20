import { describe, expect, it } from "vitest";

import { filterHref, paginate, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("keeps known values only", () => {
    expect(parseFilters({ commodity: "natgas", source: "gie_agsi" })).toEqual({
      commodity: "natgas",
      source: "gie_agsi",
    });
    expect(parseFilters({ commodity: "'; drop table", source: "unknown" })).toEqual({
      commodity: undefined,
      source: undefined,
    });
    expect(parseFilters({ commodity: ["natgas", "crude"] })).toEqual({
      commodity: undefined,
      source: undefined,
    });
  });

  it("reads a bounded page number", () => {
    expect(parseFilters({ page: "3" }).page).toBe(3);
    expect(parseFilters({ page: "1" }).page).toBeUndefined();
    for (const bad of ["0", "-2", "2.5", "1e3", "abc", "99999", ""]) {
      expect(parseFilters({ page: bad }).page).toBeUndefined();
    }
    expect(parseFilters({ page: ["2", "3"] }).page).toBeUndefined();
  });
});

describe("filterHref", () => {
  it("builds shareable URLs", () => {
    expect(filterHref({}, { commodity: "crude" })).toBe("/data?commodity=crude");
    expect(filterHref({ commodity: "crude", source: "eia" }, { commodity: undefined })).toBe(
      "/data?source=eia",
    );
    expect(filterHref({ source: "eia" }, { source: undefined })).toBe("/data");
  });

  it("keeps filters across pages and resets the page when a filter changes", () => {
    expect(filterHref({ source: "eia" }, { page: 2 })).toBe("/data?source=eia&page=2");
    expect(filterHref({ source: "eia", page: 2 }, { page: 1 })).toBe("/data?source=eia");
    expect(filterHref({ page: 4 }, { commodity: "crude" })).toBe("/data?commodity=crude");
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 120 }, (_, i) => i);

  it("slices pages of the given size", () => {
    expect(paginate(items, 1, 50)).toMatchObject({ page: 1, pageCount: 3, from: 1, to: 50 });
    const last = paginate(items, 3, 50);
    expect(last).toMatchObject({ page: 3, from: 101, to: 120, total: 120 });
    expect(last.items).toEqual(items.slice(100));
  });

  it("clamps a page past the end to the last page", () => {
    expect(paginate(items, 9, 50).page).toBe(3);
  });

  it("handles an empty list", () => {
    expect(paginate([], 2, 50)).toMatchObject({ items: [], page: 1, pageCount: 1, from: 0, to: 0 });
  });
});
