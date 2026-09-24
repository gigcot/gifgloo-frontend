import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://cloud.umami.is/script.js", (route) => route.abort());
  await page.addInitScript(() => {
    Object.assign(window, {
      umami: {
        identify: () => undefined,
        track: (name: string, data: Record<string, unknown>) => {
          const events = JSON.parse(sessionStorage.getItem("test_events") ?? "[]");
          events.push({ name, data });
          sessionStorage.setItem("test_events", JSON.stringify(events));
        },
      },
    });
  });
  await page.route("**/users/me", (route) => route.fulfill({
    json: { user_id: "test-user", email: "test@example.com" },
  }));
  await page.route("**/credits/balance", (route) => route.fulfill({
    json: { balance: 20, remaining_uses: 2, nearest_expires_at: null },
  }));
  await page.route("**/api/gif?**", (route) => route.fulfill({
    json: { result: true, data: { data: [], current_page: 1, per_page: 12, has_next: false } },
  }));
});

test("preserves first campaign across callback and deduplicates signup on reload", async ({ page }) => {
  await page.goto("/?utm_source=friend&utm_campaign=exp001&utm_content=message_a");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("analytics_campaign")))
    .toContain("utm_campaign=exp001");
  await page.goto("/callback?is_new_user=true");
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]")))
    .toEqual([{ name: "signup_completed", data: {
      utm_source: "friend", utm_campaign: "exp001", utm_content: "message_a",
    } }]);
  await page.goto("/callback?is_new_user=true&utm_campaign=other");
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]")))
    .toHaveLength(1);
  expect(await page.evaluate(() => sessionStorage.getItem("analytics_campaign")))
    .toContain("utm_campaign=exp001");
  await page.goto("/compose");
  await page.locator('input[type="file"]').setInputFiles({
    name: "pet.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64"),
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]")))
    .toContainEqual({ name: "photo_uploaded", data: {
      file_type: "image/png", utm_source: "friend", utm_campaign: "exp001", utm_content: "message_a",
    } });
});

test("returning login does not emit signup", async ({ page }) => {
  await page.goto("/callback");
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => sessionStorage.getItem("analytics_signup_pending"))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]")))
    .toEqual([]);
});
