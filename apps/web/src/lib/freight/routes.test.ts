import { describe, expect, it } from "vitest";

import { extraDays, ROUTES } from "./routes";

describe("routes", () => {
  it("loads the generated table", () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(6);
    expect(ROUTES.every((r) => r.variants.length > 0)).toBe(true);
  });

  it("measures each variant against the route's shortest", () => {
    const gulfEurope = ROUTES.find((r) => r.id === "crude_gulf_europe");
    expect(gulfEurope).toBeDefined();
    const [suez, cape] = gulfEurope!.variants;
    expect(extraDays(gulfEurope!, suez)).toBe(0);
    expect(extraDays(gulfEurope!, cape)).toBeCloseTo(cape.days - suez.days, 1);
  });
});
