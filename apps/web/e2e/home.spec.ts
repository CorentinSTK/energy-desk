import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (db/fixtures/ci_catalog.sql) or a local one. With the
// fixture most series are absent, so the map shows "no data" rather than breaking.

test.describe("home page", () => {
  test("renders the benchmark strip, map controls, map and Today in energy", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Energy Desk" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Benchmark prices" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Layer" })).toBeVisible();
    await expect(page.getByRole("group", { name: /Map of Europe/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today in energy" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("layer, measure and view live in the URL", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Layer" })
      .getByRole("link", { name: "Power prices" })
      .click();
    await expect(page).toHaveURL(/\/\?layer=power$/);
    await page
      .getByRole("navigation", { name: "Measure" })
      .getByRole("link", { name: "5-year percentile" })
      .click();
    await expect(page).toHaveURL(/\/\?layer=power&metric=percentile$/);
    await page
      .getByRole("navigation", { name: "View" })
      .getByRole("link", { name: "World (oil)" })
      .click();
    await expect(page).toHaveURL(/view=world/);
    await expect(page.getByRole("group", { name: /World map/ })).toBeVisible();
  });

  test("a selected marker opens its panel from the URL", async ({ page }) => {
    await page.goto("/?view=world&focus=choke-hormuz");
    const panel = page.getByRole("region", { name: "Details: Strait of Hormuz" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/freight and shipping phase/)).toBeVisible();
    await panel.getByRole("link", { name: "Close" }).click();
    await expect(page).toHaveURL(/\/\?view=world$/);
  });

  test("unknown parameters fall back to defaults", async ({ page }) => {
    await page.goto("/?view=%3Cscript%3E&layer=x&focus=%3Cb%3E");
    await expect(page.getByRole("group", { name: /Map of Europe/ })).toBeVisible();
    // Scoped to <main>: while streaming, Next.js keeps a hidden copy of the content outside it.
    await expect(page.getByRole("main").getByText("Select a country or a marker")).toBeVisible();
  });

  test("has no horizontal page scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
