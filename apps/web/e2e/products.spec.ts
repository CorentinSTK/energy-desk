import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (db/fixtures/ci_catalog.sql) or a local one. With the
// fixture most product series are absent, so cards must show empty states rather than break.

test.describe("refined products page", () => {
  test("renders the template: header, KPIs, main chart, tabs", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/markets/products");
    await expect(page.getByRole("heading", { level: 1, name: "Refined products" })).toBeVisible();
    await expect(page.getByText("US Gulf Coast 3-2-1 crack", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How profitable is refining?" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the fuel choice for EU pump prices lives in the URL", async ({ page }) => {
    await page.goto("/markets/products");
    await page
      .getByRole("navigation", { name: "Fuel" })
      .getByRole("link", { name: /Petrol/ })
      .click();
    await expect(page).toHaveURL(/\/markets\/products\?fuel=petrol$/);
    await expect(
      page.getByRole("heading", { name: "What does petrol cost at the pump across the EU?" }),
    ).toBeVisible();
    // The fuel is kept when switching tabs.
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: "Balance & stocks" })
      .click();
    await expect(page).toHaveURL(/\/markets\/products\?tab=balance&fuel=petrol$/);
  });

  test("ICE gasoil positioning is a declared gap", async ({ page }) => {
    await page.goto("/markets/products?tab=positioning");
    await expect(
      page.getByText("ICE gasoil positioning is not shown").filter({ visible: true }),
    ).toBeVisible();
  });

  test("has no horizontal page scroll", async ({ page }) => {
    await page.goto("/markets/products");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
