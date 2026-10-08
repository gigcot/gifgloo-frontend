import { defineConfig, devices } from "@playwright/test";

const E2E_ORIGIN = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results/e2e-runs",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: E2E_ORIGIN,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    ...(process.env.E2E_CROSS_BROWSER === "true" ? [
      { name: "firefox", use: { ...devices["Desktop Firefox"] } },
      { name: "webkit", use: { ...devices["Desktop Safari"] } },
    ] : []),
  ],
  webServer: {
    command: process.env.E2E_PRODUCTION === "true"
      ? "npm run start -- --hostname 127.0.0.1 --port 3100"
      : "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: `${E2E_ORIGIN}/compose`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
