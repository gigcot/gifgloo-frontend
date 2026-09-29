import { expect, test, type Page } from "@playwright/test";

type SurveySetup = {
  submissions: Record<string, unknown>[];
  balanceRequests: number;
};

async function setupSurvey(page: Page, eligible = true): Promise<SurveySetup> {
  const state: SurveySetup = { submissions: [], balanceRequests: 0 };
  let submitted = false;

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
    json: { user_id: "exp001-user", email: "exp001@example.com" },
  }));
  await page.route("**/credits/balance", (route) => {
    state.balanceRequests += 1;
    return route.fulfill({
      json: {
        balance: submitted ? 30 : 20,
        remaining_uses: submitted ? 3 : 2,
        nearest_expires_at: null,
      },
    });
  });
  await page.route("**/experiments/exp-001/survey", async (route) => {
    if (route.request().method() === "POST") {
      state.submissions.push(route.request().postDataJSON());
      submitted = true;
      await route.fulfill({ json: { submitted: true } });
      return;
    }
    await route.fulfill({ json: { eligible, submitted } });
  });
  await page.route("**/api/gif?**", (route) => route.fulfill({
    json: {
      result: true,
      data: { data: [], current_page: 1, per_page: 12, has_next: false },
    },
  }));

  return state;
}

test("eligible user submits the survey and receives refreshed credit balance", async ({ page }) => {
  const state = await setupSurvey(page);
  await page.goto("/");

  const header = page.locator("header");
  const credit = header.getByText("남은 이용권 2회");
  const surveyCta = header.getByRole("button", { name: "이용권 받기", exact: true });
  const purchase = header.getByRole("link", { name: "구매", exact: true });
  await expect(credit).toBeVisible();
  await expect(surveyCta).toBeVisible();
  await expect(purchase).toBeVisible();

  const creditBox = await credit.boundingBox();
  const surveyBox = await surveyCta.boundingBox();
  const purchaseBox = await purchase.boundingBox();
  expect(creditBox!.x).toBeLessThan(surveyBox!.x);
  expect(surveyBox!.x).toBeLessThan(purchaseBox!.x);

  await surveyCta.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("설문에 참여하시면 이용권 1회를 드립니다")).toBeVisible();
  await dialog.getByRole("button", { name: "설문 시작" }).click();
  const dialogBox = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(Math.abs(dialogBox!.y + dialogBox!.height / 2 - viewport!.height / 2)).toBeLessThan(2);
  await dialog.getByLabel("단체 채팅방", { exact: true }).check();
  await dialog.getByLabel("기기에 저장했다").check();
  await expect(dialog.getByRole("group", { name: /사용하지 않은 가장 큰 이유/ })).toBeVisible();
  await dialog.getByLabel("개인 소장만 하려고 했다").check();
  await dialog.getByPlaceholder("예: 친구 단톡방에서 반응 짤로").fill("친구 단톡방");
  await dialog.getByRole("button", { name: "제출하고 이용권 1회 받기" }).click();

  await expect(dialog.getByText("이용권 1회가 지급됐어요")).toBeVisible();
  await expect(header.getByRole("button", { name: "이용권 받기", exact: true })).toHaveCount(0);
  await expect(header.getByText("남은 이용권 3회")).toBeVisible();
  expect(state.submissions).toEqual([
    {
      intended_context: "group_chat",
      actual_actions: ["saved"],
      non_external_use_reason: "personal_keep",
      next_context: "친구 단톡방",
    },
  ]);
  expect(state.balanceRequests).toBeGreaterThanOrEqual(2);

  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]"));
  expect(events.map((event: { name: string }) => event.name)).toEqual(expect.arrayContaining([
    "exp001_survey_cta_clicked",
    "exp001_survey_opened",
    "exp001_survey_started",
    "exp001_survey_submitted",
  ]));
  expect(JSON.stringify(events)).not.toContain("personal_keep");
});

test("eligible mobile user sees the CTA as a second row inside the sticky header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupSurvey(page);
  await page.goto("/");

  const header = page.locator("header");
  const logo = header.getByRole("link", { name: "gifgloo" });
  const surveyCta = header.getByRole("button", { name: "이용권 받기", exact: true });
  await expect(surveyCta).toBeVisible();
  await expect(header.getByRole("link", { name: "구매", exact: true })).toBeHidden();

  const logoBox = await logo.boundingBox();
  const surveyBox = await surveyCta.boundingBox();
  const headerBox = await header.boundingBox();
  expect(surveyBox!.y).toBeGreaterThan(logoBox!.y + logoBox!.height);
  expect(surveyBox!.width).toBeGreaterThan(340);
  expect(surveyBox!.y + surveyBox!.height).toBeLessThanOrEqual(
    headerBox!.y + headerBox!.height,
  );
});

test("ineligible user does not see the survey CTA", async ({ page }) => {
  await setupSurvey(page, false);
  await page.goto("/");

  await expect(page.getByRole("button", { name: "이용권 받기", exact: true })).toHaveCount(0);
});
