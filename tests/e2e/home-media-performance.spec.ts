import { expect, test } from "@playwright/test";

const API_CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3100",
  "Content-Type": "application/json",
};

function gifItem(id: number) {
  const format = {
    url: "/punch_pepe_podo.mp4",
    width: 320,
    height: 320,
    size: 102_400,
  };
  const sizes = { mp4: format };

  return {
    id,
    slug: `gif-${id}`,
    title: `GIF ${id}`,
    file: { hd: sizes, md: sizes, sm: sizes, xs: sizes },
    blur_preview: "",
  };
}

test("loads optimized home media and deduplicates auth lookup", async ({ page }) => {
  let authRequests = 0;
  let authenticated = false;
  const mediaRequests: string[] = [];

  await page.addInitScript(() => {
    const testWindow = window as typeof window & {
      __identifiedUserIds?: string[];
      umami?: {
        track: () => void;
        identify: (userId: string) => void;
      };
    };
    testWindow.__identifiedUserIds = [];
    testWindow.umami = {
      track: () => undefined,
      identify: (userId) => testWindow.__identifiedUserIds?.push(userId),
    };
  });
  await page.route("https://cloud.umami.is/script.js", (route) => route.abort());

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\.(gif|mp4)$/.test(pathname)) mediaRequests.push(pathname);
  });

  await page.route("http://localhost:8000/users/me", async (route) => {
    authRequests += 1;
    if (!authenticated) {
      await route.fulfill({ status: 401, headers: API_CORS_HEADERS, body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: API_CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        user_id: "user-123",
        email: "member@example.com",
      }),
    });
  });
  await page.route("http://localhost:8000/credits/balance", async (route) => {
    await route.fulfill({
      status: 200,
      headers: API_CORS_HEADERS,
      body: JSON.stringify({
        balance: 20,
        remaining_uses: 2,
        nearest_expires_at: null,
      }),
    });
  });
  await page.route("**/api/gif?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: true,
        data: {
          data: Array.from({ length: 12 }, (_, index) => gifItem(index + 1)),
          current_page: 1,
          per_page: 12,
          has_next: false,
        },
      }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("합성할 GIF를 찾아보세요")).toBeVisible();
  await expect.poll(() => authRequests).toBe(1);
  await page.waitForTimeout(500);

  expect(mediaRequests.some((pathname) => pathname.endsWith(".mp4"))).toBe(true);
  expect(mediaRequests.filter((pathname) => pathname.endsWith(".gif"))).toEqual([]);

  await page.getByText("GIF 1", { exact: true }).first().click();
  authenticated = true;
  await page.getByRole("button", { name: "네, 만들기" }).click();
  await expect.poll(() => authRequests).toBe(2);
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __identifiedUserIds?: string[] }).__identifiedUserIds,
  )).toEqual(["user-123"]);
});
