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
  const sizes = { mp4: format, gif: { ...format, url: "/test-source.gif" } };

  return {
    id,
    slug: `gif-${id}`,
    title: `GIF ${id}`,
    file: { hd: sizes, md: sizes, sm: sizes, xs: sizes },
    blur_preview: "",
  };
}

test("loads only the active story, defers GIF discovery and deduplicates auth lookup", async ({ page }) => {
  let authRequests = 0;
  let authenticated = false;
  let gifRequests = 0;
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

  await page.route("http://localhost:8000/**", route => route.fulfill({ status: 500, json: { message: "Unexpected mocked endpoint" } }));
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
    gifRequests += 1;
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

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hero = page.getByRole("region", { name: "개인화 GIF 예시", exact: true });
  await expect(hero).toBeVisible();
  await expect.poll(() => authRequests).toBe(1);
  const firstStory = hero.locator("[data-story][data-phase]");
  await expect(firstStory).toHaveAttribute("data-phase", "source");
  const firstId = await firstStory.getAttribute("data-story");
  const firstSources = await firstStory.locator("video[src], img[src]").evaluateAll(elements =>
    elements.map(element => new URL(element.getAttribute("src")!, location.origin).pathname),
  );
  await expect.poll(() => mediaRequests.length).toBeGreaterThan(0);
  expect(mediaRequests.every(pathname => firstSources.includes(pathname))).toBe(true);
  expect(gifRequests).toBe(0);
  await expect(hero.getByRole("button", { name: "슬라이드 재생", exact: true })).toBeVisible();
  const next = hero.getByRole("button", { name: "다음 슬라이드", exact: true });
  await next.click();
  await expect(firstStory).toHaveAttribute("data-phase", "result");
  await next.click();
  await expect(firstStory).toHaveAttribute("data-phase", "chat");
  expect(mediaRequests.every(pathname => firstSources.includes(pathname))).toBe(true);
  await next.click();
  await expect(firstStory).not.toHaveAttribute("data-story", firstId!);
  await expect.poll(() => mediaRequests.some(pathname => !firstSources.includes(pathname))).toBe(true);
  expect(gifRequests).toBe(0);

  await page.getByRole("link", { name: "장면 찾기", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "GIF 검색" })).toBeVisible();
  await expect.poll(() => gifRequests).toBe(1);
  await expect(page.getByRole("button", { name: "GIF 1 선택", exact: true })).toBeVisible();
  await expect.poll(() => mediaRequests.includes("/punch_pepe_podo.mp4")).toBe(true);
  expect(mediaRequests).not.toContain("/test-source.gif");
  await page.getByRole("button", { name: "GIF 1 선택", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(mediaRequests).not.toContain("/test-source.gif");
  authenticated = true;
  await page.getByRole("group", { name: "선택한 GIF", exact: true }).getByRole("button", { name: "사진 고르기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await expect(page.getByAltText("my photo")).toHaveCount(0);
  await expect.poll(() => authRequests).toBe(2);
  await expect.poll(() => page.evaluate(
    () => (window as typeof window & { __identifiedUserIds?: string[] }).__identifiedUserIds,
  )).toEqual(["user-123"]);
});
