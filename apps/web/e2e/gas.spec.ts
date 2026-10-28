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
    await expect(page.getByText("EU storage, % full").filter({ visible: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Are EU gas stocks tight for the season?" }),
    ).toBeVisible();
    // Every unofficial item carries the mandatory label, whatever data is loaded.
    const label = "Yahoo Finance — unofficial, delayed, research only";
    for (const name of [
      "TTF front month (NYMEX)",
      "TTF M1–M2 spread (NYMEX)",
      "Is the TTF prompt curve",
    ]) {
      const card = page.locator('[data-slot="card"]', { hasText: name }).filter({ visible: true });
      await expect(card.getByText(label).filter({ visible: true })).toBeVisible();
    }
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
      page
        .getByText("TTF positioning (Commitments of Traders) is not shown")
        .filter({ visible: true }),
    ).toBeVisible();
  });

  test("storage tab keeps the selected country in the URL", async ({ page }) => {
    await page.goto("/markets/gas?tab=storage&area=fr");
    await expect(page.getByRole("heading", { name: /Is France storage tight/ })).toBeVisible();
  });

  test("unknown parameters fall back to defaults", async ({ page }) => {
    await page.goto("/markets/gas?tab=%3Cscript%3E&area=zz");
    // Role queries ignore hidden nodes (streamed content is inserted hidden before it is swapped in).
    const title = page.getByRole("heading", {
      name: "Is the TTF prompt curve in backwardation or contango?",
    });
    await expect(title).toBeVisible();
    await expect(title).toHaveCount(1);
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
