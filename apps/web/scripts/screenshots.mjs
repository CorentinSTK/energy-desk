/**
 * README screenshots, taken with Playwright from the live site (real data, never the style guide).
 *
 *   node scripts/screenshots.mjs                       # https://energy-desk-two.vercel.app
 *   BASE_URL=http://localhost:3000 node scripts/screenshots.mjs
 *
 * Writes docs/screenshots/<page>-<theme>.png at 1440×900, plus one phone-width view.
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "https://energy-desk-two.vercel.app";
const OUT = fileURLToPath(new URL("../../../docs/screenshots/", import.meta.url));

const PAGES = [
  { name: "home", path: "/" },
  { name: "gas", path: "/markets/gas" },
  { name: "power", path: "/markets/power" },
  { name: "forecasts", path: "/forecasts/eu_storage_30d" },
  { name: "lab", path: "/lab/backtest?preset=brent_wti_mean_reversion" },
];
const THEMES = ["dark", "light"];
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** Open a page in a theme and wait until its data and the charts in view have rendered. */
async function open(browser, path, theme, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  // next-themes reads the choice from localStorage before the first paint.
  await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByRole("heading", { level: 1 }).waitFor();
  // Charts are created when near the viewport (lazy ECharts); give them time to draw.
  await page.waitForTimeout(2_000);
  return page;
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
for (const { name, path } of PAGES) {
  for (const theme of THEMES) {
    const page = await open(browser, path, theme, DESKTOP);
    await page.screenshot({ path: `${OUT}${name}-${theme}.png` });
    await page.close();
    console.log(`${name}-${theme}.png`);
  }
}
const phone = await open(browser, "/markets/gas", "dark", PHONE);
await phone.screenshot({ path: `${OUT}gas-phone-dark.png` });
console.log("gas-phone-dark.png");
await browser.close();
