import { expect, test } from "@playwright/test";

// Runs against a database: the CI fixture (no PortWatch series, so charts show empty states) or a
// local one with the transit history.

test.describe("freight page", () => {
  test("renders the template: header, chokepoint KPIs, main chart, tabs", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto("/markets/freight");
    await expect(page.getByRole("heading", { level: 1, name: "Freight & shipping" })).toBeVisible();
    await expect(
      page
        .getByText("Strait of Hormuz, tankers per day", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Are the oil and LNG chokepoints open?" }),
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the chokepoint and the tab live in the URL", async ({ page }) => {
    await page.goto("/markets/freight");
    await page
      .getByRole("navigation", { name: "Chokepoint" })
      .getByRole("link", { name: "Cape of Good Hope" })
      .click();
    await expect(page).toHaveURL(/\/markets\/freight\?strait=cape$/);
    await expect(
      page.getByRole("heading", {
        name: "Is Cape of Good Hope busier or quieter than usual for the season?",
      }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: "Routes & voyage times" })
      .click();
    await expect(page).toHaveURL(/tab=routes/);
  });

  test("routes are computed and say so; freight rates are a declared gap", async ({ page }) => {
    await page.goto("/markets/freight?tab=routes");
    const table = page
      .getByRole("table", { name: "Sea distances and days at sea on benchmark routes" })
      .filter({ visible: true });
    await expect(table.getByText("Gulf crude to Europe", { exact: true })).toBeVisible();
    await expect(table.getByText("Cape of Good Hope").first()).toBeVisible();
    await expect(page.getByText(/Computed, not observed/).filter({ visible: true })).toBeVisible();
    await page.goto("/markets/freight?tab=gaps");
    await expect(
      page
        .getByText("Tanker and LNG carrier freight rates", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
  });
});

test.describe("who carries what", () => {
  test("switches commodity and shows each class with its source", async ({ page }) => {
    await page.goto("/markets/freight");
    const section = page.getByRole("region", { name: "Who carries what" });
    await expect(section.getByText("VLCC", { exact: true })).toBeVisible();
    await section.getByRole("button", { name: "LNG" }).click();
    await expect(section.getByRole("button", { name: "LNG" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(section.getByText("Q-Max", { exact: true })).toBeVisible();
    await expect(section.getByRole("link", { name: "Wikipedia, Q-Max" })).toHaveAttribute(
      "href",
      "https://en.wikipedia.org/wiki/Q-Max",
    );
  });
});
