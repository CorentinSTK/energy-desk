import { describe, expect, it } from "vitest";

import { FLEETS, formatCapacity, MIN_RELATIVE_SIZE, relativeSize } from "@/lib/freight/vessels";

describe("vessel classes", () => {
  it("lists each commodity's classes largest first, each with a source", () => {
    for (const fleet of FLEETS) {
      const tops = fleet.classes.map((c) => c.high);
      expect(tops).toEqual([...tops].sort((a, b) => b - a));
      for (const c of fleet.classes) {
        expect(c.low).toBeLessThanOrEqual(c.high);
        expect(c.sources.length).toBeGreaterThan(0);
        for (const s of c.sources) expect(s.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("sizes the largest class at 1 and never below the minimum", () => {
    for (const fleet of FLEETS) {
      expect(relativeSize(fleet, fleet.classes[0])).toBe(1);
      for (const c of fleet.classes) {
        expect(relativeSize(fleet, c)).toBeGreaterThanOrEqual(MIN_RELATIVE_SIZE);
      }
    }
  });

  it("formats ranges and single figures", () => {
    const crude = FLEETS.find((f) => f.id === "crude")!;
    const products = FLEETS.find((f) => f.id === "products")!;
    expect(formatCapacity(crude.classes[0])).toBe("1.9–2.2 million");
    expect(formatCapacity(crude.classes[1])).toBe("about 1 million");
    expect(formatCapacity(products.classes[0])).toBe("345,000–615,000");
  });
});
