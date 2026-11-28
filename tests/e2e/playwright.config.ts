import { defineConfig, devices } from "@playwright/test";

// Target site. Defaults to the dev site. CI sets E2E_BASE_URL to a deploy
// preview for pull requests and to wallet.dgentech.io for the live check.
const baseURL = process.env.E2E_BASE_URL || "https://dgentech-dev.netlify.app";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "report" }],
    ["json", { outputFile: "results.json" }],
  ],
  outputDir: "artifacts",
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    launchOptions: process.env.E2E_CHROME_PATH
      ? { executablePath: process.env.E2E_CHROME_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
