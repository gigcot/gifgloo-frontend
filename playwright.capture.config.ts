import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/capture",
  timeout: 90_000,
  workers: 1,
  reporter: "list",
  outputDir: "test-results/ui-review-run",
  use: {
    baseURL: "http://127.0.0.1:3100",
    browserName: "chromium",
    serviceWorkers: "block",
    permissions: ["clipboard-read", "clipboard-write"],
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: "npm run build && npm run start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/compose",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_BASE: "http://localhost:8000",
      NEXT_PUBLIC_ANALYTICS_INTERNAL: "true",
    },
  },
});
