import { expect, test } from "@playwright/test";

const API_CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Origin": "http://127.0.0.1:3000",
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
  const mediaRequests: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/\.(gif|mp4)$/.test(pathname)) mediaRequests.push(pathname);
  });

  await page.route("http://localhost:8000/users/me", async (route) => {
    authRequests += 1;
    await route.fulfill({ status: 401, headers: API_CORS_HEADERS, body: "{}" });
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

  await page.goto("/");
  await expect(page.getByText("합성할 GIF를 찾아보세요")).toBeVisible();
  await expect.poll(() => authRequests).toBe(1);
  await page.waitForTimeout(500);

  expect(mediaRequests.some((pathname) => pathname.endsWith(".mp4"))).toBe(true);
  expect(mediaRequests.filter((pathname) => pathname.endsWith(".gif"))).toEqual([]);
});
