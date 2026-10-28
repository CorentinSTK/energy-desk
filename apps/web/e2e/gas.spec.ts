import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (db/fixtures/ci_catalog.sql) or a local one. With the
// fixture most gas series are absent, so cards must show empty states rather than break.

test.describe("gas market page", () => {
  test("renders the template: header, KPIs, main chart, tabs", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/markets/gas");
    await expect(
      page.getByRole("heading", { level: 1, name: "European natural gas" }),
    ).toBeVisible();
    await expect(page.getByText("EU storage, % full")).toBeVisible();
    await expect(page.getByText("Are EU gas stocks tight for the season?")).toBeVisible();
    // Unofficial values always carry the mandatory label.
    await expect(
      page.getByText("Yahoo Finance — unofficial, delayed, research only").first(),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("tabs are links with shareable URLs", async ({ page }) => {
    await page.goto("/markets/gas");
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: "Positioning" })
      .click();
    await expect(page).toHaveURL(/\/markets\/gas\?tab=positioning$/);
    await expect(
      page.getByText("TTF positioning (Commitments of Traders) is not shown"),
    ).toBeVisible();
  });

  test("storage tab keeps the selected country in the URL", async ({ page }) => {
    await page.goto("/markets/gas?tab=storage&area=fr");
    await expect(page.getByRole("heading", { name: /Is France storage tight/ })).toBeVisible();
  });

  test("unknown parameters fall back to defaults", async ({ page }) => {
    await page.goto("/markets/gas?tab=%3Cscript%3E&area=zz");
    await expect(
      page.getByText("Is the TTF prompt curve in backwardation or contango?"),
    ).toBeVisible();
  });

  test("has no horizontal page scroll", async ({ page }) => {
    await page.goto("/markets/gas?tab=flows");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
