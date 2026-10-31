import { expect, type Page, test } from "@playwright/test";

/** Fails the test on any browser console error or uncaught exception. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("home renders in the dark theme by default", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Energy Desk" })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  expect(errors).toEqual([]);
});

test("theme toggle switches to light and back", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle light/dark theme" });
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/\btheme-light\b/);
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test.describe("style guide", () => {
  test("shows every component in both themes, with charts and demo banners", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/styleguide");

    for (const theme of ["dark", "light"]) {
      const panel = page.getByTestId(`theme-panel-${theme}`);
      await expect(panel).toHaveClass(new RegExp(`\\b${theme}\\b`));
      for (const section of ["Colour tokens", "Primitives", "Chart cards", "States and notices"]) {
        await expect(panel.getByRole("heading", { name: section })).toBeVisible();
      }
      // 4 rendered charts per theme (time series, seasonal, unofficial, stale). Charts are created
      // only as they near the viewport, so bring each one into view first.
      const charts = panel.locator('[role="img"][aria-label]:not(svg)');
      for (const chart of await charts.all()) await chart.scrollIntoViewIfNeeded();
      await expect(panel.locator("canvas")).toHaveCount(4);
      await expect(
        panel.getByText("Yahoo Finance — unofficial, delayed, research only"),
      ).toHaveCount(1);
    }

    // Every card in the style guide carries the synthetic-data banner (12 per theme).
    await expect(page.getByText("DEMO — synthetic data, not market data")).toHaveCount(24);
    expect(errors).toEqual([]);
  });

  test("is not indexed", async ({ page, request }) => {
    await page.goto("/styleguide");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /styleguide");
  });

  test("has no horizontal scroll", async ({ page }) => {
    await page.goto("/styleguide");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
