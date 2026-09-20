import { expect, test } from "@playwright/test";

const FRONTEND_ORIGIN = "http://127.0.0.1:3000";
const API_CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Origin": FRONTEND_ORIGIN,
  "Content-Type": "application/json",
};

test("shows a countdown modal and retries composition when the wait ends", async ({ page }) => {
  let compositionRequests = 0;

  await page.addInitScript(() => {
    localStorage.setItem("compose_gif", JSON.stringify({
      id: "e2e-gif",
      slug: "e2e-gif",
      title: "E2E GIF",
      file: {
        hd: { gif: { url: "/punch_pepe_hwang.gif", width: 320, height: 320, size: 1 } },
        md: { gif: { url: "/punch_pepe_hwang.gif", width: 320, height: 320, size: 1 } },
        sm: {},
        xs: {},
      },
      blur_preview: "",
    }));
  });

  await page.route("http://localhost:8000/users/me", async (route) => {
    await route.fulfill({
      status: 200,
      headers: API_CORS_HEADERS,
      body: JSON.stringify({ email: "e2e@example.com" }),
    });
  });
  await page.route("http://localhost:8000/credits/balance", async (route) => {
    await route.fulfill({
      status: 200,
      headers: API_CORS_HEADERS,
      body: JSON.stringify({ balance: 20, remaining_uses: 2, nearest_expires_at: null }),
    });
  });
  await page.route("http://localhost:8000/compositions", async (route) => {
    compositionRequests += 1;
    if (compositionRequests === 1) {
      await route.fulfill({
        status: 429,
        headers: {
          ...API_CORS_HEADERS,
          "Access-Control-Expose-Headers": "Retry-After",
          "Retry-After": "30",
        },
        body: JSON.stringify({
          error: "COMPOSITION_UNAVAILABLE",
          message: "30초 후 다시 시도해 주세요",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: API_CORS_HEADERS,
      body: JSON.stringify({ composition_job_id: "e2e-job" }),
    });
  });

  await page.goto("/compose");
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
  await expect(page.getByAltText("my photo")).toBeVisible();

  await page.clock.install();
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();

  const waitDialog = page.getByRole("dialog");
  await expect(waitDialog).toBeVisible();
  await expect(waitDialog).toHaveAccessibleName("조금만 기다려 주세요");
  await expect(waitDialog.getByText("30", { exact: true })).toBeVisible();
  await expect(waitDialog.getByRole("button", { name: "30초 후 다시 시도" })).toBeDisabled();

  await page.screenshot({ path: "test-results/composition-wait-modal.png", fullPage: true });

  await page.clock.fastForward(1_000);
  await expect(waitDialog.getByText("29", { exact: true })).toBeVisible();

  await page.clock.fastForward(29_000);
  await expect(waitDialog).toHaveAccessibleName("이제 합성을 시작할 수 있어요");
  const retryButton = waitDialog.getByRole("button", { name: "다시 합성하기" });
  await expect(retryButton).toBeEnabled();
  await retryButton.click();

  await expect.poll(() => compositionRequests).toBe(2);
  await expect(waitDialog).toBeHidden();
});
