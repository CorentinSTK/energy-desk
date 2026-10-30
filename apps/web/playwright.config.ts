import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const isCI = Boolean(process.env.CI);
/** Set to test a deployed site instead of a local server, e.g. PLAYWRIGHT_BASE_URL=https://… */
const remoteBaseURL = process.env.PLAYWRIGHT_BASE_URL;

/** Smoke tests on the main pages. In CI they run against the production build (`next start`). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  // A page variant rendered for the first time (cold serverless function on the live site, or
  // compilation on the dev server) can take longer than the 5 s default after a click.
  expect: { timeout: 15_000 },
  use: { baseURL: remoteBaseURL ?? `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: remoteBaseURL
    ? undefined
    : {
        command: isCI ? "npm run start" : "npm run dev",
        port: PORT,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
