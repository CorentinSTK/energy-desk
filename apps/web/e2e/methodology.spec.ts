import { expect, test } from "@playwright/test";

test.describe("methodology", () => {
  test("has every section, reachable from its table of contents", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByRole("heading", { level: 1, name: "Methodology" })).toBeVisible();
    for (const title of [
      "Principles",
      "Seasonal norms",
      "Forecasts",
      "Data licensing",
      "Known limits",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await page
      .getByRole("navigation", { name: "On this page" })
      .getByRole("link", { name: "Data licensing" })
      .click();
    await expect(page).toHaveURL(/#licensing$/);
  });

  test("lists the sources from the catalogue, with licences", async ({ page }) => {
    await page.goto("/methodology#licensing");
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Licence" })).toBeVisible();
  });
});
