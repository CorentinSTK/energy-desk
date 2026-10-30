// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { europeGeometry, placeMarkers, worldGeometry } = await import("./geometry");
const { MARKERS, TERMINALS } = await import("./markers");

describe("map geometry", () => {
  const europe = europeGeometry();

  it("draws the EU countries and keeps the page light", () => {
    const names = new Set(europe.countries.map((c) => c.name));
    for (const name of ["France", "Germany", "Malta", "Cyprus", "Finland", "Portugal"]) {
      expect(names.has(name)).toBe(true);
    }
    const bytes = europe.countries.reduce((sum, c) => sum + c.d.length, 0);
    expect(bytes).toBeLessThan(300_000);
  });

  it("puts every Europe marker inside the frame", () => {
    const europeMarkers = MARKERS.filter((m) => m.view === "europe");
    expect(placeMarkers(europe, europeMarkers)).toHaveLength(europeMarkers.length);
    const worldMarkers = MARKERS.filter((m) => m.view === "world");
    expect(placeMarkers(worldGeometry(), worldMarkers)).toHaveLength(worldMarkers.length);
  });

  it("gives every marker an id the URL accepts", () => {
    expect(MARKERS.every((m) => /^[a-z0-9-]{1,40}$/.test(m.id))).toBe(true);
    expect(new Set(MARKERS.map((m) => m.id)).size).toBe(MARKERS.length);
  });

  it("spreads markers that share a point so each stays clickable", () => {
    const fos = TERMINALS.filter((t) => t.id.startsWith("lng-fos"));
    const [a, b] = placeMarkers(europe, fos);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(10);
  });
});
