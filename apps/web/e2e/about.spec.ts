import { expect, test } from "@playwright/test";

test.describe("about and footer", () => {
  test("about page shows the project, the stack and the author's links", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible();
    for (const title of ["The project", "How it is built", "Author"]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
      "href",
      /linkedin\.com\/in\//,
    );
    await expect(main.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      /github\.com\/CorentinSTK\/energy-desk/,
    );
  });

  test("the footer links to the reference pages", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("navigation", { name: "Footer" });
    await footer.getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/about$/);
  });

  test("sitemap and share image are served", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/methodology</loc>");
    expect(sitemap).not.toContain("/styleguide");
    const image = await request.get("/opengraph-image");
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  });
});
