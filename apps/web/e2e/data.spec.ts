import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (db/fixtures/ci_catalog.sql) or a local one.

test.describe("data catalogue", () => {
  test("lists series with source, licence and freshness", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/data");

    await expect(page.getByRole("heading", { level: 1, name: "Data catalogue" })).toBeVisible();
    const seriesTable = page.getByRole("table").first();
    await expect(seriesTable.locator("tbody tr").first()).toBeVisible();
    await expect(seriesTable.getByText("fx.eurusd")).toBeVisible();
    // Every row shows a freshness badge or a dash.
    await expect(seriesTable.getByText(/^(Fresh|Delayed|Stale)$/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ingestion runs, last 30 days" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not covered, and why" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("filters are links with shareable URLs", async ({ page }) => {
    await page.goto("/data");
    await page
      .getByRole("navigation", { name: "Filter by commodity" })
      .getByRole("link", { name: "FX" })
      .click();
    await expect(page).toHaveURL(/\/data\?commodity=fx$/);
    const codes = await page
      .getByRole("table")
      .first()
      .locator("tbody tr td:first-child .font-mono")
      .allTextContents();
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every((code) => code.startsWith("fx."))).toBe(true);
  });

  test("unknown filter values are ignored", async ({ page }) => {
    await page.goto("/data?commodity=%27%3Bdrop&source=nope");
    await expect(page.getByRole("table").first().locator("tbody tr").first()).toBeVisible();
  });

  test("has no horizontal page scroll", async ({ page }) => {
    await page.goto("/data");
    await expect(page.getByRole("table").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
