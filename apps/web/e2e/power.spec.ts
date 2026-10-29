import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (db/fixtures/ci_catalog.sql) or a local one. With the
// fixture the power series are absent, so cards must show empty states rather than break.

test.describe("power market page", () => {
  test("renders the template: header, KPIs, zone selector, main chart, tabs", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/markets/power");
    await expect(page.getByRole("heading", { level: 1, name: "European power" })).toBeVisible();
    await expect(page.getByText("DE-LU day-ahead base").filter({ visible: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Is Germany power expensive for the season?" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Power zone" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("zone and tab live in the URL", async ({ page }) => {
    await page.goto("/markets/power");
    await page
      .getByRole("navigation", { name: "Power zone" })
      .getByRole("link", { name: "Great Britain" })
      .click();
    await expect(page).toHaveURL(/\/markets\/power\?zone=gb$/);
    // GB is the Elexon market index, labelled as such (never called a day-ahead price).
    await expect(
      page.getByText("GB market index (Elexon MID)").filter({ visible: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: "Flows" })
      .click();
    await expect(page).toHaveURL(/\/markets\/power\?zone=gb&tab=flows$/);
    await expect(
      page.getByRole("heading", { name: "Is Great Britain importing or exporting power?" }),
    ).toBeVisible();
  });

  test("German flows are a declared gap", async ({ page }) => {
    await page.goto("/markets/power?tab=flows");
    await expect(
      page.getByText("German cross-border flows are not shown yet").filter({ visible: true }),
    ).toBeVisible();
  });

  test("unknown parameters fall back to defaults", async ({ page }) => {
    await page.goto("/markets/power?zone=%3Cscript%3E&tab=zz");
    const title = page.getByRole("heading", { name: /How did Germany prices move hour by hour/ });
    await expect(title).toBeVisible();
    await expect(title).toHaveCount(1);
  });

  test("has no horizontal page scroll", async ({ page }) => {
    await page.goto("/markets/power?zone=fr&tab=balance");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
