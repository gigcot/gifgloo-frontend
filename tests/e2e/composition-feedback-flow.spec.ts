import { expect, test, type Page } from "@playwright/test";

const FRONTEND_ORIGIN = "http://127.0.0.1:3100";
const API_CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Origin": FRONTEND_ORIGIN,
  "Content-Type": "application/json",
};

type RequestState = {
  feedback: boolean[];
  shareRequests: number;
};

async function openCompletedComposition(page: Page): Promise<RequestState> {
  const state: RequestState = { feedback: [], shareRequests: 0 };

  await page.addInitScript(() => {
    localStorage.setItem("compose_gif", JSON.stringify({
      id: "feedback-e2e-gif",
      slug: "feedback-e2e-gif",
      title: "Feedback E2E GIF",
      file: {
        hd: { gif: { url: "/punch_pepe_hwang.gif", width: 320, height: 320, size: 1 } },
        md: { gif: { url: "/punch_pepe_hwang.gif", width: 320, height: 320, size: 1 } },
        sm: {},
        xs: {},
      },
      blur_preview: "",
    }));
  });

  await page.route("https://cloud.umami.is/script.js", (route) => route.abort());
  await page.route("http://localhost:8000/users/me", (route) => route.fulfill({
    status: 200,
    headers: API_CORS_HEADERS,
    body: JSON.stringify({ user_id: "feedback-e2e-user", email: "e2e@example.com" }),
  }));
  await page.route("http://localhost:8000/credits/balance", (route) => route.fulfill({
    status: 200,
    headers: API_CORS_HEADERS,
    body: JSON.stringify({ balance: 1_000, remaining_uses: 100, nearest_expires_at: null }),
  }));
  await page.route("http://localhost:8000/compositions/uploads", (route) => route.fulfill({
    status: 200,
    headers: API_CORS_HEADERS,
    body: JSON.stringify({
      upload_id: "feedback-e2e-upload",
      upload_url: "http://localhost:8000/test-upload",
      headers: { "Content-Type": "image/png" },
    }),
  }));
  await page.route("http://localhost:8000/test-upload", (route) => route.fulfill({ status: 200 }));
  await page.route("http://localhost:8000/compositions/from-upload", (route) => route.fulfill({
    status: 200,
    headers: API_CORS_HEADERS,
    body: JSON.stringify({ composition_job_id: "feedback-e2e-job" }),
  }));
  await page.route("http://localhost:8000/compositions/feedback-e2e-job/status", (route) => route.fulfill({
    status: 200,
    headers: {
      ...API_CORS_HEADERS,
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
    },
    body: `data: ${JSON.stringify({
      status: "COMPLETED",
      stage: null,
      result_url: "/icon.png",
      result_asset_id: "feedback-e2e-asset",
      failed_reason: null,
      credit_settlement: {
        balance_before: 1_000,
        charged: 10,
        refunded: 0,
        balance_after: 990,
      },
    })}\n\n`,
  }));
  await page.route("http://localhost:8000/compositions/feedback-e2e-job/feedback", async (route) => {
    const body = route.request().postDataJSON() as { satisfied: boolean };
    state.feedback.push(body.satisfied);
    await route.fulfill({ status: 204, headers: API_CORS_HEADERS });
  });
  await page.route("http://localhost:8000/assets/feedback-e2e-asset/share", async (route) => {
    state.shareRequests += 1;
    await route.fulfill({
      status: 200,
      headers: API_CORS_HEADERS,
      body: JSON.stringify({ share_token: "feedback-e2e-share" }),
    });
  });

  await page.goto("/compose");
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await page.getByRole("button", { name: "시작하기" }).click();
  await expect(page.getByAltText("합성 결과")).toBeVisible();

  return state;
}

test("keeps the result visible and places feedback before actions and usage", async ({ page }) => {
  await openCompletedComposition(page);

  await page.waitForTimeout(1_000);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const result = await page.getByAltText("합성 결과").boundingBox();
  const feedback = await page.getByRole("button", { name: "아쉬워요" }).boundingBox();
  const download = await page.getByRole("button", { name: "다운로드" }).boundingBox();
  const usage = await page.getByText("사용 전").boundingBox();

  expect(result?.width).toBeGreaterThan(500);
  expect(result!.y + result!.height).toBeLessThan(feedback!.y);
  expect(feedback!.y).toBeLessThan(download!.y);
  expect(download!.y).toBeLessThan(usage!.y);
});

test("asks for feedback without an image and resumes link sharing", async ({ page }) => {
  const state = await openCompletedComposition(page);

  await page.getByRole("button", { name: "링크 복사" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(0);
  expect(state.shareRequests).toBe(0);

  await dialog.getByRole("button", { name: "만족해요" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state.feedback).toEqual([true]);
  await expect.poll(() => state.shareRequests).toBe(1);
  await expect(page.getByText("평가해 주셔서 감사해요")).toBeVisible();
});

test("resumes opening the profile menu after feedback", async ({ page }) => {
  const state = await openCompletedComposition(page);

  await page.locator("header").getByRole("button").last().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "아쉬워요" }).click();

  await expect.poll(() => state.feedback).toEqual([false]);
  await expect(page.getByRole("button", { name: "내 에셋" })).toBeVisible();
});

test("resumes home navigation after feedback", async ({ page }) => {
  const state = await openCompletedComposition(page);

  await page.getByRole("link", { name: "gifgloo" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "만족해요" }).click();

  await expect.poll(() => state.feedback).toEqual([true]);
  await expect(page).toHaveURL("/");
});
