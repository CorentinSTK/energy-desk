import { expect, test } from "@playwright/test";

// The cards added in the market deep dive (26 Nov 2026). With the CI fixture most series are
// absent, so the cards render their empty state: the heading must still be there.
const CARDS: [string, RegExp][] = [
  ["/markets/power", /What shape does a Germany power day have/],
  ["/markets/power", /How often do prices go negative/],
  ["/markets/power?tab=balance", /Is it windy in Germany/],
  ["/markets/power?tab=balance", /Is it sunny in Germany/],
  ["/markets/power?zone=fr&tab=balance", /Is France colder than usual/],
  ["/markets/power?tab=flows", /Is Germany-Luxembourg importing or exporting power/],
  ["/markets/gas?tab=storage", /Is Europe drawing on storage faster than usual/],
  ["/markets/crude?tab=balance", /days of refinery runs/],
  ["/markets/products?tab=balance", /Is US jet fuel demand strong/],
];

for (const [path, heading] of CARDS) {
  test(`${path} shows "${heading.source}"`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("stale notices are gone", async ({ page }) => {
  await page.goto("/markets/power?tab=flows");
  await expect(page.getByText("German cross-border flows are not shown yet")).toHaveCount(0);
  await page.goto("/markets/crude?tab=flows");
  await expect(page.getByText(/chokepoints .* are not shown yet/)).toHaveCount(0);
});
