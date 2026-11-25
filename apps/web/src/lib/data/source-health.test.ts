import { describe, expect, it } from "vitest";

import type { CatalogSeries, IngestRun } from "@/lib/data/catalog";
import { sourceHealth } from "@/lib/data/source-health";

const now = new Date("2026-11-25T12:00:00Z");

function series(code: string, source: string, last: string | null): CatalogSeries {
  return {
    code,
    name: code,
    commodity: "power",
    region: "DE",
    unit: "€/MWh",
    frequency: "daily",
    source,
    sourceRef: "",
    description: "",
    isUnofficial: false,
    priceKind: null,
    license: "",
    licenseUrl: null,
    attribution: null,
    publicationLagDays: 0,
    observationCount: 1,
    firstObservation: last,
    lastObservation: last,
    gapCount: 0,
    largestIntervalDays: null,
  };
}

function run(source: string, startedAt: string, status: IngestRun["status"]): IngestRun {
  return {
    id: 1,
    source,
    startedAt,
    finishedAt: startedAt,
    status,
    rowsWritten: 0,
    rowsRejected: 0,
    error: null,
  };
}

describe("sourceHealth", () => {
  it("counts series by freshness and takes the latest run", () => {
    const [h] = sourceHealth(
      [series("a", "smard", "2026-11-24T00:00:00Z"), series("b", "smard", "2026-09-01T00:00:00Z")],
      [run("smard", "2026-11-24T14:00:00Z", "ok"), run("smard", "2026-11-25T14:00:00Z", "partial")],
      now,
    );
    expect(h.series).toEqual({ fresh: 1, delayed: 0, stale: 1 });
    expect(h.latestRun?.status).toBe("partial");
    expect(h.lastSuccessAt).toBe("2026-11-25T14:00:00Z");
    expect(h.overall).toBe("stale");
  });

  it("flags a failed latest run whatever the freshness", () => {
    const [h] = sourceHealth(
      [series("a", "eia", "2026-11-24T00:00:00Z")],
      [run("eia", "2026-11-25T17:00:00Z", "failed"), run("eia", "2026-11-24T17:00:00Z", "ok")],
      now,
    );
    expect(h.overall).toBe("failed");
    expect(h.lastSuccessAt).toBe("2026-11-24T17:00:00Z");
  });
});
