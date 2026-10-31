import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (few series) or a local one with full history.

test.describe("lab", () => {
  test("the overview links both tools and every preset", async ({ page }) => {
    await page.goto("/lab");
    await expect(page.getByRole("heading", { level: 1, name: "Lab" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "DE–FR day-ahead spread, mean reversion" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Trade simulator" }).first()).toBeVisible();
  });

  test("a preset loads its rule into the form and the URL drives the rule", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/lab/backtest?preset=brent_wti_mean_reversion");
    await expect(page.getByRole("heading", { level: 1, name: "Rule backtester" })).toBeVisible();
    await expect(page.getByLabel("N", { exact: true })).toHaveValue("120");
    await page.getByLabel("N", { exact: true }).fill("60");
    await page.getByRole("button", { name: "Run backtest" }).click();
    await expect(page).toHaveURL(/win=60/);
    await expect(page.getByLabel("N", { exact: true })).toHaveValue("60");
    expect(errors).toEqual([]);
  });

  test("invalid parameters fall back to safe defaults", async ({ page }) => {
    await page.goto("/lab/backtest?traded=%3Cscript%3E&win=999999&ind=eval");
    await expect(page.getByLabel("N", { exact: true })).toHaveValue("60");
    await expect(page.getByLabel("Traded series")).toHaveValue("de_fr");
  });

  test("the simulator validates the stop side", async ({ page }) => {
    await page.goto("/lab/simulator?series=brent&side=long&entry=100&stop=110&target=120");
    // The CI fixture database has no Brent history: the page then says the simulator is unavailable.
    await expect(
      page.getByText(/the stop must be below the entry|The simulator is unavailable/),
    ).toBeVisible();
    const unavailable = page.getByText("The simulator is unavailable");
    test.skip(await unavailable.isVisible(), "no Brent history in this database");
    await expect(page.getByText("the stop must be below the entry")).toBeVisible();
  });

  test("has no horizontal page scroll", async ({ page }) => {
    await page.goto("/lab/backtest?preset=crack_low_percentile");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
