import { expect, test } from "@playwright/test";

/**
 * Mobile pass (M8): at a 390 px phone width, no page scrolls sideways. Wide tables and charts must
 * scroll inside their own container instead. Add each new page here.
 */
const PAGES = [
  "/",
  "/markets/gas",
  "/markets/gas?tab=flows",
  "/markets/lng",
  "/markets/power",
  "/markets/crude",
  "/markets/products",
  "/forecasts",
  "/data",
];

test.use({ viewport: { width: 390, height: 844 } });

for (const path of PAGES) {
  test(`${path} has no horizontal scroll at 390 px`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
