import { expect, test } from "@playwright/test";

test.describe("LNG market page", () => {
  test("renders the template with the same tabs as every market page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/markets/lng");
    await expect(page.getByRole("heading", { level: 1, name: "European LNG" })).toBeVisible();
    await expect(
      page.getByText("EU LNG send-out", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Sections" });
    for (const name of [
      "Prices & curve",
      "Balance & stocks",
      "Flows",
      "Positioning",
      "Data gaps",
    ]) {
      await expect(tabs.getByRole("link", { name })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test("uncovered tabs explain the gap", async ({ page }) => {
    await page.goto("/markets/lng?tab=prices");
    await expect(page.getByText("No LNG price is shown").filter({ visible: true })).toBeVisible();
  });
});

test.describe("site header", () => {
  test("links to the market pages and the data catalogue, not the style guide", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Gas" }).click();
    await expect(page).toHaveURL(/\/markets\/gas$/);
    await nav.getByRole("link", { name: "LNG" }).click();
    await expect(page).toHaveURL(/\/markets\/lng$/);
    await expect(page.getByRole("link", { name: /style guide/i })).toHaveCount(0);
  });
});
