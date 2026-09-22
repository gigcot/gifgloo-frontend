import { defineConfig, devices } from "@playwright/test";

const E2E_ORIGIN = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
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
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: `${E2E_ORIGIN}/compose`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
