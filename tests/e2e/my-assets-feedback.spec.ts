import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function setup(context: BrowserContext) {
  const state = {
    saved: new Map<string, boolean>(), puts: [] as boolean[], shares: 0, reads: 0,
    readFails: false, delayRead: false, delayWrite: false, loseResponse: false,
    eligible: false, surveySubmitted: false, surveyPosts: 0, session: true,
  };
  const job = (id: string) => ({ job_id: id, status: "COMPLETED", stage: null,
    source_gif_url: "/icon.png", target_asset_id: null, result_url: "/icon.png",
    result_asset_id: `asset-${id}`, created_at: "2026-10-09T00:00:00Z" });
  await context.addInitScript(() => {
    window.umami = { identify() {}, track(name, data) {
      const events = JSON.parse(sessionStorage.getItem("feedback_events") ?? "[]");
      events.push({ name, data });
      sessionStorage.setItem("feedback_events", JSON.stringify(events));
    } };
  });
  await context.route("https://cloud.umami.is/**", route => route.abort());
  await context.route("http://localhost:8000/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === "/users/me") return route.fulfill(state.session
      ? { json: { user_id: "owner", user_kind: "anonymous", consent_required: false } }
      : { status: 401, json: {} });
    if (path === "/credits/balance") return route.fulfill({ json: { balance: 20, remaining_uses: 2, nearest_expires_at: null } });
    if (path === "/experiments/exp-001/survey") {
      if (request.method() === "POST") { state.surveyPosts++; state.surveySubmitted = true; }
      return route.fulfill({ json: { eligible: state.eligible, submitted: state.surveySubmitted } });
    }
    if (path === "/compositions") return route.fulfill(state.session
      ? { json: { jobs: [job("one"), job("two")] } } : { status: 401, json: {} });
    const feedback = path.match(/^\/compositions\/(one|two)\/feedback$/);
    if (feedback) {
      const id = feedback[1];
      if (request.method() === "GET") {
        state.reads++;
        while (state.delayRead && !context.pages().every(page => page.isClosed())) await new Promise(resolve => setTimeout(resolve, 20));
        return route.fulfill(state.readFails ? { status: 503, json: {} } : { json: { satisfied: state.saved.get(id) ?? null } });
      }
      const { satisfied } = request.postDataJSON();
      state.puts.push(satisfied);
      while (state.delayWrite && !context.pages().every(page => page.isClosed())) await new Promise(resolve => setTimeout(resolve, 20));
      if (state.saved.has(id)) return route.fulfill({ status: 409, json: {} });
      state.saved.set(id, satisfied);
      if (state.loseResponse) return route.abort();
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/share")) { state.shares++; return route.fulfill({ json: { share_token: "test-share" } }); }
    if (/^\/compositions\/(one|two)\/status$/.test(path)) return route.fulfill({
      contentType: "text/event-stream", body: `data: ${JSON.stringify(job(path.split("/")[2]))}\n\n`,
    });
    if (/^\/compositions\/(one|two)$/.test(path)) return route.fulfill({ json: job(path.split("/")[2]) });
    return route.fulfill({ status: 500, json: { error: "Unexpected endpoint" } });
  });
  return state;
}

async function openResult(page: Page, index = 0) {
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "완성된 GIF 보기" }).nth(index).click();
  await expect(page.getByRole("heading", { name: "결과는 어땠나요?" })).toBeVisible();
}

test("first feedback persists across My Assets, reload and compose, but another result remains eligible", async ({ page, context }) => {
  const state = await setup(context);
  await openResult(page);
  await page.getByRole("button", { name: "아쉬워요", exact: true }).click();
  await expect(page.getByText(/‘아쉬워요’로 응답했어요/)).toBeVisible();
  await expect(page.getByRole("button", { name: "만족해요", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("button", { name: "완성된 GIF 보기" }).first().click();
  await expect(page.getByText(/‘아쉬워요’로 응답했어요/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "완성된 GIF 보기" }).first().click();
  await expect(page.getByText(/‘아쉬워요’로 응답했어요/)).toBeVisible();
  await page.goto("/compose?job=one");
  await expect(page.getByText(/‘아쉬워요’로 응답했어요/)).toBeVisible();
  await openResult(page, 1);
  await page.getByRole("button", { name: "만족해요", exact: true }).click();
  await expect(page.getByText(/‘만족해요’로 응답했어요/)).toBeVisible();
  expect(state.puts).toEqual([false, true]);
});

test("loading and failed reads do not masquerade as unsubmitted or block share", async ({ page, context }) => {
  const state = await setup(context);
  state.delayRead = true;
  await openResult(page);
  await expect(page.getByText("평가 상태를 확인하고 있어요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "만족해요", exact: true })).toHaveCount(0);
  state.readFails = true; state.delayRead = false;
  await expect(page.getByRole("button", { name: "평가 상태 다시 확인" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다운로드", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "링크 복사" }).click();
  expect(state.shares).toBe(1);
  expect(state.puts).toEqual([]);
  state.readFails = false;
  await page.getByRole("button", { name: "평가 상태 다시 확인" }).click();
  await expect(page.getByRole("button", { name: "만족해요", exact: true })).toBeEnabled();
});

test("rapid clicks send one request while saving", async ({ page, context }) => {
  const state = await setup(context);
  await openResult(page);
  const satisfied = page.getByRole("button", { name: "만족해요", exact: true });
  await expect(satisfied).toBeEnabled();
  state.delayWrite = true;
  await satisfied.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect.poll(() => state.puts.length).toBe(1);
  await expect(page.getByRole("button", { name: "아쉬워요", exact: true })).toBeDisabled();
  state.delayWrite = false;
  await expect(page.getByText(/‘만족해요’로 응답했어요/)).toBeVisible();
  expect(state.puts).toEqual([true]);
});

test("a stale second tab restores the first response without a second success event", async ({ page, context }) => {
  const state = await setup(context);
  const second = await context.newPage();
  await openResult(page); await openResult(second);
  await expect(second.getByRole("button", { name: "만족해요", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "아쉬워요", exact: true }).click();
  await expect(page.getByText(/‘아쉬워요’로 응답했어요/)).toBeVisible();
  await second.getByRole("button", { name: "만족해요", exact: true }).click();
  await expect(second.getByText(/‘아쉬워요’로 응답했어요/)).toBeVisible();
  expect(state.saved.get("one")).toBe(false);
  const events = await second.evaluate(() => JSON.parse(sessionStorage.getItem("feedback_events") ?? "[]")) as { name: string }[];
  expect(events.filter(event => event.name === "composition_feedback_submitted")).toHaveLength(0);
});

test("lost write response recovers the stored answer by reading without resubmission", async ({ page, context }) => {
  const state = await setup(context);
  state.loseResponse = true;
  await openResult(page);
  await page.getByRole("button", { name: "만족해요", exact: true }).click();
  await page.getByRole("button", { name: "평가 상태 다시 확인" }).click();
  await expect(page.getByText(/‘만족해요’로 응답했어요/)).toBeVisible();
  expect(state.puts).toEqual([true]);
});

test("notification return offers the same one-time feedback", async ({ page, context }) => {
  const state = await setup(context);
  await page.goto("/my-assets?job=one&from=notification");
  const result = page.getByRole("region", { name: "알림으로 돌아온 결과" });
  await result.getByRole("button", { name: "만족해요", exact: true }).click();
  await expect(result.getByText(/‘만족해요’로 응답했어요/)).toBeVisible();
  await page.reload();
  await expect(result.getByText(/‘만족해요’로 응답했어요/)).toBeVisible();
  expect(state.puts).toEqual([true]);
});

test("eligible survey opens above the result and disappears after submission without requiring feedback", async ({ page, context }) => {
  const state = await setup(context);
  state.eligible = true;
  await openResult(page);
  const invitation = page.getByRole("region", { name: "추가 설문 안내" });
  await invitation.getByRole("button", { name: "설문 참여하기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("설문에 참여하시면 이용권 1회를 드립니다")).toBeVisible();
  await dialog.getByRole("button", { name: "설문 시작" }).click();
  await dialog.getByLabel("단체 채팅방", { exact: true }).check();
  await dialog.getByLabel("단체 채팅방에 보냈다", { exact: true }).check();
  await dialog.getByRole("button", { name: "제출하고 이용권 1회 받기" }).click();
  await expect(dialog.getByText("이용권 1회가 지급됐어요")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "완성된 GIF 보기" }).first().click();
  await expect(invitation).toHaveCount(0);
  await expect(page.getByRole("button", { name: "만족해요", exact: true })).toBeEnabled();
  expect(state.surveyPosts).toBe(1); expect(state.puts).toEqual([]);
});

test("ineligible result viewer has no survey invitation", async ({ page, context }) => {
  await setup(context);
  await openResult(page);
  await expect(page.getByRole("button", { name: "만족해요", exact: true })).toBeEnabled();
  await expect(page.getByRole("region", { name: "추가 설문 안내" })).toHaveCount(0);
});

test("expired session hides the result and ignores a late feedback read", async ({ page, context }) => {
  const state = await setup(context);
  state.delayRead = true;
  state.saved.set("one", false);
  await openResult(page);
  await expect(page.getByText("평가 상태를 확인하고 있어요.")).toBeVisible();
  state.session = false;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "결과는 어땠나요?" })).toHaveCount(0);
  state.delayRead = false;
  await expect(page.getByText(/‘아쉬워요’로 응답했어요/)).toHaveCount(0);
  expect(state.puts).toEqual([]);
});

for (const width of [320, 1440]) test(`result feedback and eligible survey fit at ${width}px`, async ({ page, context }, testInfo) => {
  const state = await setup(context);
  state.eligible = true;
  await page.setViewportSize({ width, height: 900 });
  await openResult(page);
  const rating = page.getByRole("button", { name: "아쉬워요", exact: true });
  await expect(rating).toBeEnabled();
  await rating.scrollIntoViewIfNeeded();
  await expect(rating).toBeInViewport();
  const left = await rating.boundingBox();
  const right = await page.getByRole("button", { name: "만족해요", exact: true }).boundingBox();
  expect(left!.height).toBeGreaterThanOrEqual(44);
  expect(right!.height).toBeGreaterThanOrEqual(44);
  expect(right!.x - (left!.x + left!.width)).toBeGreaterThanOrEqual(9);
  await expect(rating).toHaveCSS("border-top-width", "1px");
  const invitation = page.getByRole("region", { name: "추가 설문 안내" });
  await invitation.scrollIntoViewIfNeeded();
  await expect(invitation.getByRole("button", { name: "설문 참여하기" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: testInfo.outputPath(`my-assets-feedback-${width}.png`) });
});
