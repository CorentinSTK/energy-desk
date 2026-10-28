import { describe, expect, it } from "vitest";

import { extractionDates, resolveAttribution } from "./attribution";

const runs = [
  { source: "entsog", status: "ok", finishedAt: "2026-10-27T21:31:00Z" },
  { source: "entsog", status: "failed", finishedAt: "2026-10-28T21:31:00Z" },
  { source: "entsog", status: "partial", finishedAt: "2026-10-26T21:31:00Z" },
  { source: "ecb", status: "running", finishedAt: null },
];

describe("extractionDates", () => {
  it("uses the latest successful run per source, as DD-MM-YYYY", () => {
    expect(extractionDates(runs)).toEqual({ entsog: "27-10-2026" });
  });
});

describe("resolveAttribution", () => {
  const dates = extractionDates(runs);

  it("fills the extraction date", () => {
    expect(
      resolveAttribution(
        "Source: ENTSOG TP [{extraction_date}] https://transparency.entsog.eu/",
        "entsog",
        dates,
      ),
    ).toBe("Source: ENTSOG TP [27-10-2026] https://transparency.entsog.eu/");
  });

  it("says so when no successful run is known", () => {
    expect(resolveAttribution("[{extraction_date}]", "ecb", dates)).toBe(
      "[extraction date unknown]",
    );
  });

  it("leaves other texts unchanged", () => {
    expect(resolveAttribution("Source: ECB statistics.", "ecb", dates)).toBe(
      "Source: ECB statistics.",
    );
    expect(resolveAttribution(null, "ecb", dates)).toBeNull();
  });
});
