import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const isCI = Boolean(process.env.CI);

/** Smoke tests on the main pages. In CI they run against the production build (`next start`). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: isCI ? "npm run start" : "npm run dev",
    port: PORT,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
