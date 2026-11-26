import { describe, expect, it } from "vitest";

import type { ChokepointId } from "@/lib/freight/chokepoints";
import { isDisrupted, variantStates } from "@/lib/freight/route-map";
import { ROUTES } from "@/lib/freight/routes";

const route = (id: string) => ROUTES.find((r) => r.id === id)!;

describe("isDisrupted", () => {
  it("flags traffic at least 40% below the norm", () => {
    expect(isDisrupted(-55)).toBe(true);
    expect(isDisrupted(-19)).toBe(false);
    expect(isDisrupted(null)).toBe(false);
  });
});

describe("variantStates", () => {
  it("uses the shortest variant when nothing is disrupted", () => {
    expect(variantStates(route("crude_gulf_europe"), new Set())).toEqual(["in use", "alternative"]);
  });

  it("sends Gulf crude round the Cape when Bab el-Mandeb is disrupted", () => {
    const disrupted = new Set<ChokepointId>(["bab_el_mandeb"]);
    expect(variantStates(route("crude_gulf_europe"), disrupted)).toEqual(["disrupted", "in use"]);
  });

  it("shows every variant as disrupted when there is no way around", () => {
    const disrupted = new Set<ChokepointId>(["hormuz"]);
    expect(variantStates(route("crude_gulf_china"), disrupted)).toEqual(["disrupted"]);
  });
});
