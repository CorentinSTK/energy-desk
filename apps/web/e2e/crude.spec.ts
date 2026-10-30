import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (db/fixtures/ci_catalog.sql) or a local one. With the
// fixture most oil series are absent, so cards must show empty states rather than break.

test.describe("crude oil page", () => {
  test("renders the template: header, KPIs, main chart, tabs", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/markets/crude");
    await expect(page.getByRole("heading", { level: 1, name: "Crude oil" })).toBeVisible();
    await expect(page.getByText("Brent spot (EIA)", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Where are crude prices?" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    // Unofficial futures data always carries its label.
    await expect(page.getByText("Brent front month (NYMEX BZ)", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("tabs live in the URL and Brent positioning is a declared gap", async ({ page }) => {
    await page.goto("/markets/crude");
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: "Positioning" })
      .click();
    await expect(page).toHaveURL(/\/markets\/crude\?tab=positioning$/);
    await expect(
      page.getByText("Brent positioning is not shown").filter({ visible: true }),
    ).toBeVisible();
  });

  test("unknown parameters fall back to defaults", async ({ page }) => {
    await page.goto("/markets/crude?tab=%3Cscript%3E");
    await expect(
      page.getByRole("heading", { name: "How wide is the Brent–WTI spread?" }),
    ).toBeVisible();
  });

  test("has no horizontal page scroll", async ({ page }) => {
    await page.goto("/markets/crude?tab=balance");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
