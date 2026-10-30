import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (no forecasts yet) or a local one with backtests.

test.describe("forecast registry", () => {
  test("lists the three models with their live and backtest verdicts", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/forecasts");
    await expect(page.getByRole("heading", { level: 1, name: "Forecasts" })).toBeVisible();
    for (const name of [
      "EU gas storage in 30 days",
      "France daily power demand",
      "US crude stocks, next EIA report",
    ]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    await expect(page.getByText("Live:").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a model page shows its method, scores and horizons", async ({ page }) => {
    await page.goto("/forecasts/fr_power_demand");
    await expect(
      page.getByRole("heading", { level: 1, name: "France daily power demand" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scores" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Horizon" })
      .getByRole("link", { name: "3 days" })
      .click();
    await expect(page).toHaveURL(/\/forecasts\/fr_power_demand\?horizon=3$/);
    await expect(page.getByRole("heading", { name: /3 days ahead/ })).toBeVisible();
  });

  test("an unknown model is a 404 and an unknown horizon falls back", async ({ page }) => {
    const response = await page.goto("/forecasts/not_a_model");
    expect(response?.status()).toBe(404);
    await page.goto("/forecasts/fr_power_demand?horizon=99");
    await expect(page.getByRole("heading", { name: /1 day ahead/ })).toBeVisible();
  });

  test("market pages link their forecast", async ({ page }) => {
    await page.goto("/markets/crude");
    await page.getByRole("region", { name: "Related forecasts" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/forecasts\/us_crude_stocks$/);
  });
});
