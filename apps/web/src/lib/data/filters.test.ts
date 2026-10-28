import { describe, expect, it } from "vitest";

import { filterHref, parseFilters } from "./filters";

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
});

describe("filterHref", () => {
  it("builds shareable URLs", () => {
    expect(filterHref({}, { commodity: "crude" })).toBe("/data?commodity=crude");
    expect(filterHref({ commodity: "crude", source: "eia" }, { commodity: undefined })).toBe(
      "/data?source=eia",
    );
    expect(filterHref({ source: "eia" }, { source: undefined })).toBe("/data");
  });
});
