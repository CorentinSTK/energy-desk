import { describe, expect, it } from "vitest";

import { commodityOfHref } from "@/lib/commodities";

describe("commodityOfHref", () => {
  it("maps market pages to their commodity, ignoring the query string", () => {
    expect(commodityOfHref("/markets/gas?tab=storage")).toBe("natgas");
    expect(commodityOfHref("/markets/power?zone=fr")).toBe("power");
    expect(commodityOfHref("/markets/crude")).toBe("crude");
  });

  it("returns null for other pages", () => {
    expect(commodityOfHref("/forecasts")).toBeNull();
    expect(commodityOfHref("/markets/unknown")).toBeNull();
  });
});
