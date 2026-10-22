import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page, { anonymous = false, submitted = true, eligible = true, loseResponse = false, dailyReadDelay = 0 } = {}) {
  const state = { submitted, claimed: false, claimDate: "2026-10-22", serverTime: "03:00:00", grants: 0, requests: 0, surveys: 0, dailyReads: 0, surveyReads: 0 };
  await page.clock.setFixedTime(new Date("2026-10-22T03:00:00Z"));
  await page.addInitScript(() => {
    Object.assign(window, { gifglooAnalytics: {
      get_property: () => "reward-user", get_distinct_id: () => "reward-user", identify: () => {}, reset: () => {},
      capture: (name: string, data: unknown) => {
        const events = JSON.parse(sessionStorage.getItem("test_events") ?? "[]");
        events.push({ name, data }); sessionStorage.setItem("test_events", JSON.stringify(events));
      },
    } });
  });
  await page.route("http://localhost:8000/**", route => route.fulfill({ status: 500, json: { message: "Unexpected mocked endpoint" } }));
  await page.route("**/users/me", route => route.fulfill({ json: { user_id: "reward-user", user_kind: anonymous ? "anonymous" : "member", email: anonymous ? null : "reward@example.test" } }));
  await page.route("**/credits/balance", route => route.fulfill({ json: {
    balance: (2 + state.surveys + state.grants * 3) * 10,
    remaining_uses: 2 + state.surveys + state.grants * 3, nearest_expires_at: null,
  } }));
  await page.route("**/compositions", route => route.fulfill({ json: { jobs: [] } }));
  await page.route("**/experiments/exp-001/survey", route => {
    if (route.request().method() === "POST") {
      state.submitted = true; state.surveys++;
      return route.fulfill({ json: { submitted: true } });
    }
    state.surveyReads++;
    return route.fulfill({ json: { eligible, submitted: state.submitted } });
  });
  await page.route("**/experiments/exp-001/daily-reward", async route => {
    if (!state.submitted) return route.fulfill({ status: 403, json: {} });
    let granted = false;
    if (route.request().method() === "POST") {
      state.requests++;
      if (!state.claimed) { state.claimed = true; state.grants++; granted = true; }
      if (loseResponse && state.requests === 1) return route.abort();
    } else {
      state.dailyReads++;
      if (dailyReadDelay) await new Promise(resolve => setTimeout(resolve, dailyReadDelay));
    }
    return route.fulfill({ json: {
      claimed: state.claimed, granted, claim_date: state.claimDate,
      server_now: `${state.claimDate}T${state.serverTime}Z`,
      next_claim_at: `${state.claimDate}T15:00:00Z`, expires_at: state.claimed ? "2026-10-29T03:00:00Z" : null,
    } });
  });
  return state;
}

test("survey gives one use then opens profile for a separate three-use claim", async ({ page }) => {
  const state = await setup(page, { submitted: false });
  await page.goto("/my-assets");
  const invitation = page.getByRole("region", { name: "추가 설문 안내" });
  await expect(invitation).toContainText("매일 3회분");
  await invitation.getByRole("button", { name: "설문 참여하기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("어떤 답변을 선택해도 같은 혜택");
  await dialog.getByRole("button", { name: "설문 시작" }).click();
  await dialog.getByLabel("그냥 궁금해서", { exact: true }).check();
  await dialog.getByLabel("아직 결과만 확인했어요", { exact: true }).check();
  await dialog.getByLabel("쓸 예정이지만 아직 쓰지 않았다", { exact: true }).check();
  await dialog.getByRole("button", { name: "제출하고 이용권 1회 받기" }).click();
  await expect(dialog).toContainText("이용권 1회가 지급됐어요");
  await expect(page.locator("header")).toContainText("사용 가능 3회");
  expect(state.grants).toBe(0);
  await dialog.getByRole("button", { name: "프로필에서 3회 더 받기" }).click();
  await page.getByRole("button", { name: "매일 3회 받기", exact: true }).click();
  await expect(page.getByRole("button", { name: "오늘 3회 받았어요" })).toBeDisabled();
  await expect(page.locator("header")).toContainText("사용 가능 6회");
  expect(state.surveys).toBe(1);
  expect(state.grants).toBe(1);
  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]"));
  expect(events.map((event: { name: string }) => event.name)).toEqual(expect.arrayContaining([
    "survey_reward_offer_viewed", "exp001_survey_submitted", "daily_reward_claim_confirmed",
  ]));
  expect(JSON.stringify(events)).not.toContain("planned_not_yet");
});

for (const width of [390, 1280]) {
  test(`anonymous survey participant claims from profile without signup at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await setup(page, { anonymous: true });
    await page.goto("/my-assets");
    await page.getByRole("button", { name: "프로필", exact: true }).click();
    const claim = page.getByRole("button", { name: "매일 3회 받기", exact: true });
    await expect(claim).toBeEnabled();
    await page.screenshot({ path: `test-results/daily-reward-${width}.png`, fullPage: true });
    const box = await claim.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await claim.click();
    await expect(page.getByText("이용권 3회가 지급됐어요.", { exact: true })).toBeVisible();
    await expect(page.locator("header")).toContainText("비회원 · 사용 가능 5회");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "프로필", exact: true }).click();
    await expect(page.getByRole("button", { name: "오늘 3회 받았어요" })).toBeDisabled();
    expect(state.grants).toBe(1);
    expect(state.requests).toBe(1);
    await page.reload();
    await page.getByRole("button", { name: "프로필", exact: true }).click();
    await expect(page.getByRole("button", { name: "오늘 3회 받았어요" })).toBeDisabled();
  });
}

test("a lost claim response can be retried without another grant", async ({ page }) => {
  const state = await setup(page, { loseResponse: true });
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await page.getByRole("button", { name: "매일 3회 받기", exact: true }).click();
  await expect(page.getByRole("region", { name: "매일 이용권" }).getByRole("alert")).toContainText("지급을 확인하지 못했어요");
  await page.getByRole("button", { name: "매일 3회 받기", exact: true }).click();
  await expect(page.getByRole("button", { name: "오늘 3회 받았어요" })).toBeDisabled();
  await expect(page.locator("header")).toContainText("사용 가능 5회");
  expect(state.grants).toBe(1);
  expect(state.requests).toBe(2);
});

test("returning the next day refreshes daily entitlement", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await page.getByRole("button", { name: "매일 3회 받기", exact: true }).click();
  await expect(page.getByRole("button", { name: "오늘 3회 받았어요" })).toBeDisabled();
  state.claimDate = "2026-10-23"; state.claimed = false;
  await page.clock.setFixedTime(new Date("2026-10-23T03:00:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("이용권 3회가 지급됐어요.", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "매일 3회 받기", exact: true }).click();
  await expect(page.getByRole("button", { name: "오늘 3회 받았어요" })).toBeDisabled();
  expect(state.grants).toBe(2);
});

test("checking status after a lost response also refreshes the credited balance", async ({ page }) => {
  const state = await setup(page, { loseResponse: true });
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await page.getByRole("button", { name: "매일 3회 받기", exact: true }).click();
  await page.getByRole("button", { name: "상태 다시 확인", exact: true }).click();
  await expect(page.getByRole("button", { name: "오늘 3회 받았어요" })).toBeDisabled();
  await expect(page.locator("header")).toContainText("사용 가능 5회");
  expect(state.grants).toBe(1);
  expect(state.requests).toBe(1);
});

test("an unsubmitted user cannot see the daily claim even after a completed composition", async ({ page }) => {
  await setup(page, { submitted: false });
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await expect(page.getByRole("button", { name: "매일 3회 받기", exact: true })).toHaveCount(0);
});

test("focus and visibility events share one pending daily status request", async ({ page }) => {
  const state = await setup(page, { dailyReadDelay: 150 });
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await expect(page.getByRole("button", { name: "매일 3회 받기", exact: true })).toBeEnabled();
  const before = state.dailyReads;
  const refreshed = page.waitForResponse(response => response.url().endsWith("/daily-reward"));
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await refreshed;
  expect(state.dailyReads - before).toBe(1);
});

test("an ahead-of-server device clock does not poll daily status every second", async ({ page }) => {
  const state = await setup(page);
  await page.clock.setFixedTime(new Date("2026-10-23T03:00:00Z"));
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await expect(page.getByRole("button", { name: "매일 3회 받기", exact: true })).toBeEnabled();
  const before = state.dailyReads;
  await page.waitForTimeout(3200);
  expect(state.dailyReads).toBe(before);
});

test("the survey invitation shares the initial eligibility request", async ({ page }) => {
  const state = await setup(page, { submitted: false });
  await page.goto("/my-assets");
  await expect(page.getByRole("region", { name: "추가 설문 안내" })).toBeVisible();
  expect(state.surveyReads).toBe(1);
});

test("server midnight refreshes an open menu even when the device clock is wrong", async ({ page }) => {
  const state = await setup(page);
  state.claimed = true;
  state.serverTime = "14:59:58.500";
  await page.clock.setFixedTime(new Date("2030-01-01T03:00:00Z"));
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "프로필", exact: true }).click();
  await expect(page.getByRole("button", { name: "오늘 3회 받았어요" })).toBeDisabled();
  const before = state.dailyReads;
  state.claimDate = "2026-10-23";
  state.serverTime = "00:00:00";
  state.claimed = false;
  await expect(page.getByRole("button", { name: "매일 3회 받기", exact: true })).toBeEnabled();
  expect(state.dailyReads - before).toBe(1);
});
