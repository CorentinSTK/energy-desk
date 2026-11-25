import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (db/fixtures/ci_catalog.sql) or a local one. With the
// fixture the LPG series are absent, so cards must show empty states rather than break.

test.describe("LPG page", () => {
  test("renders the template: header, KPIs, main chart, tabs", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/markets/lpg");
    await expect(page.getByRole("heading", { level: 1, name: "LPG (propane)" })).toBeVisible();
    await expect(
      page.getByText("Propane as % of WTI", { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Is propane cheap or dear against crude?" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("tabs live in the URL and European prices are a declared gap", async ({ page }) => {
    await page.goto("/markets/lpg");
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: "Data gaps" })
      .click();
    await expect(page).toHaveURL(/\/markets\/lpg\?tab=gaps$/);
    await expect(page.getByText("European and Asian LPG prices")).toBeVisible();
  });

  test("an unknown tab falls back to prices", async ({ page }) => {
    await page.goto("/markets/lpg?tab=nope");
    await expect(page.getByRole("heading", { name: "Where is the propane price?" })).toBeVisible();
  });
});
