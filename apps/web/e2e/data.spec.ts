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
    // Series codes such as fx.eurusd (which page a code lands on depends on the database's size).
    await expect(seriesTable.locator("tbody tr td:first-child .font-mono").first()).toHaveText(
      /^[a-z0-9_]+\.[a-z0-9_.]+$/,
    );
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

  test("is paginated, and a page past the end shows the last one", async ({ page }) => {
    await page.goto("/data?page=999");
    await expect(
      page.getByText(/^Showing \d[\d,]*–\d[\d,]* of \d[\d,]* series$/).first(),
    ).toBeVisible();
    await expect(page.getByRole("table").first().locator("tbody tr").first()).toBeVisible();
    const pages = page.getByRole("navigation", { name: "Catalogue pages", exact: true });
    if ((await pages.count()) > 0) {
      // A full database spans several pages: the page links keep the filters and change the URL.
      await pages.getByRole("link", { name: "Page 2", exact: true }).click();
      await expect(page).toHaveURL(/\/data\?page=2$/);
    }
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

test("pipeline status lists sources and the footer links to it", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "Status" })
    .click();
  await expect(page).toHaveURL(/\/data#pipeline$/);
  await expect(page.getByRole("heading", { name: "Pipeline status" })).toBeVisible();
});
