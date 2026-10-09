import { expect, test, type Page } from "@playwright/test";

const gif = (id: string) => ({ id, slug: id, title: id, blur_preview: "", file: {
  hd: { gif: { url: "/test-frame.gif", width: 320, height: 320, size: 1 } },
  md: { gif: { url: "/icon.png", width: 320, height: 320, size: 1 } }, sm: {}, xs: {},
} });

async function setup(page: Page) {
  const state = { submissions: 0, sessions: 0, user: true, status: "PENDING", access: 200,
    gifRequests: [] as string[], failMore: false, delayMore: false, listRequests: 0, listFails: false };
  await page.addInitScript(() => {
    window.umami = { identify() {}, track(name, data) {
      const events = JSON.parse(sessionStorage.getItem("explorer_events") ?? "[]");
      events.push({ name, data });
      sessionStorage.setItem("explorer_events", JSON.stringify(events));
    } };
  });
  await page.route("https://cloud.umami.is/**", route => route.abort());
  await page.route("http://localhost:8000/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const job = { job_id: "return-job", status: state.status, stage: null,
      source_gif_url: "/icon.png", target_asset_id: null,
      result_url: state.status === "COMPLETED" ? "/icon.png" : null, result_asset_id: "result",
      created_at: "2026-10-09T00:00:00Z", credit_settlement: { balance_before: 20, charged: 10, refunded: 10, balance_after: 20 } };
    if (path === "/users/me") return route.fulfill(state.user ? { json: { user_id: "owner", user_kind: "anonymous", consent_required: false } } : { status: 401, json: {} });
    if (path === "/users/anonymous-session") { state.sessions++; return route.fulfill({ status: 500, json: {} }); }
    if (path === "/credits/balance") return route.fulfill({ json: { balance: 20 - state.submissions * 10, remaining_uses: 2 - state.submissions, nearest_expires_at: null } });
    if (path === "/experiments/exp-001/survey") return route.fulfill({ json: { eligible: false, submitted: false } });
    if (path === "/web-push/config") return route.fulfill({ json: { enabled: false, public_key: null } });
    if (path === "/compositions/uploads") return route.fulfill({ json: { upload_id: "upload", upload_url: "http://localhost:8000/upload", headers: { "Content-Type": "image/png" } } });
    if (path === "/upload") return route.fulfill({ status: 200 });
    if (path === "/compositions/from-upload") { state.submissions++; return route.fulfill({ json: { composition_job_id: "return-job" } }); }
    if (path === "/compositions/return-job/status") return route.fulfill(state.access === 200
      ? { contentType: "text/event-stream", body: `data: ${JSON.stringify(job)}\n\n` }
      : { status: state.access, json: {} });
    if (path === "/compositions/return-job") return route.fulfill({ status: state.access, json: job });
    if (path === "/compositions/return-job/feedback") return route.fulfill({ json: { satisfied: null } });
    if (path === "/compositions") { state.listRequests++; return route.fulfill(state.listFails ? { status: 503, json: {} } : { json: { jobs: [job] } }); }
    return route.fulfill({ status: 500, json: { error: "Unexpected mocked endpoint" } });
  });
  await page.route("**/api/gif?**", async route => {
    const params = new URL(route.request().url()).searchParams;
    const type = params.get("type");
    if (type === "categories") return route.fulfill({ json: { result: true, data: { categories: [{ category: "귀여워", query: "aww" }, { category: "안녕", query: "hello" }] } } });
    const pageNumber = Number(params.get("page") ?? 1);
    const source = params.get("q") ?? type;
    state.gifRequests.push(`${source}:${pageNumber}`);
    if (pageNumber > 1) {
      while (state.delayMore && !page.isClosed()) await new Promise(resolve => setTimeout(resolve, 20));
      if (state.failMore) return route.fulfill({ status: 503, json: {} });
    }
    return route.fulfill({ json: { result: true, data: {
      data: Array.from({ length: 24 }, (_, index) => gif(`${source}-${pageNumber}-${index}`)), current_page: pageNumber, has_next: pageNumber < 3,
    } } });
  });
  const frame = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
  await page.context().route("**/test-frame.gif", route => route.fulfill({ contentType: "image/gif", body: frame }));
  return state;
}

async function submit(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "trending-1-0 선택", exact: true }).click();
  await page.getByRole("button", { name: "이 GIF로 만들기" }).click();
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose\?job=return-job$/);
}

test("accepted job survives My Results, browser back, reload and direct return without resubmission", async ({ page }) => {
  const state = await setup(page);
  await submit(page);
  await page.getByRole("link", { name: "내 결과", exact: true }).click();
  await expect(page.getByRole("button", { name: "진행 중인 작업 이어 보기" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/compose\?job=return-job$/);
  await expect(page.getByRole("heading", { name: "GIF를 만들고 있어요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "만들기", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "GIF를 만들고 있어요" })).toBeVisible();
  state.status = "COMPLETED";
  await page.reload();
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  expect(state.submissions).toBe(1);
  expect(state.sessions).toBe(0);
});

test("My Results refreshes active jobs, retains the last list on error and exposes failed job return", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "진행 중인 작업 이어 보기" }).click();
  await expect(page).toHaveURL(/\/compose\?job=return-job$/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "진행 중인 작업 이어 보기" })).toBeVisible();
  state.listFails = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/아래는 마지막으로 확인한 목록/)).toBeVisible();
  await expect(page.getByRole("button", { name: "진행 중인 작업 이어 보기" })).toBeVisible();
  state.listFails = false;
  state.status = "COMPLETED";
  await expect(page.getByRole("button", { name: "완성된 GIF 보기" })).toBeVisible({ timeout: 8000 });
  state.status = "FAILED";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByRole("button", { name: "실패한 작업 확인" }).click();
  await expect(page.getByRole("heading", { name: "작업에 실패했습니다" })).toBeVisible();
  await expect(page.getByText("사용한 이용권 1회가 복구되었습니다.")).toBeVisible();
  expect(state.submissions).toBe(0);
});

for (const access of [401, 403, 404]) test(`inaccessible job ${access} does not restart work or show another result`, async ({ page }) => {
  const state = await setup(page);
  state.access = access;
  await page.goto("/compose?job=return-job");
  await expect(page.getByRole("heading", { name: "작업을 확인할 수 없어요" })).toBeVisible();
  await expect(page.getByAltText("합성 결과")).toHaveCount(0);
  if (access === 403) {
    await page.getByRole("button", { name: "새로 만들기", exact: true }).click();
    await expect(page.getByRole("heading", { name: "어떤 사진을 넣어볼까요?" })).toBeVisible();
    const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("explorer_events")!)) as { name: string }[];
    expect(events.some(event => event.name === "composition_retry_clicked")).toBe(false);
  }
  expect(state.submissions).toBe(0);
  expect(state.sessions).toBe(0);
});

test("return without a session does not create a new anonymous identity or consume a pending GIF", async ({ page }) => {
  const state = await setup(page);
  state.user = false;
  await page.addInitScript(saved => localStorage.setItem("compose_gif", JSON.stringify(saved)), gif("pending"));
  await page.goto("/compose?job=return-job");
  await expect(page.getByRole("heading", { name: "작업을 확인할 수 없어요" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("compose_gif")!).id)).toBe("pending");
  expect(state.sessions).toBe(0);
  expect(state.submissions).toBe(0);
});

for (const source of ["trending", "search", "category"]) test(`${source} uses explicit load more; scroll never fetches and failed page retries in place`, async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  if (source === "search") await page.getByRole("searchbox", { name: "GIF 검색" }).fill("cat");
  if (source === "category") {
    await page.getByRole("button", { name: "카테고리 선택", exact: true }).click();
    await page.getByRole("button", { name: "귀여워", exact: true }).click();
  }
  const key = source === "trending" ? "trending" : source === "search" ? "cat" : "aww";
  await expect(page.getByRole("button", { name: `${key}-1-0 선택`, exact: true })).toBeVisible();
  const list = page.getByTestId("gif-results");
  await list.evaluate(element => { element.scrollTop = element.scrollHeight; element.dispatchEvent(new Event("scroll")); });
  await expect(page.getByRole("button", { name: "더 보기", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(state.gifRequests.filter(request => request === `${key}:2`)).toHaveLength(0);
  state.failMore = true;
  state.delayMore = true;
  await page.getByRole("button", { name: "더 보기", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole("button", { name: "불러오는 중…" })).toBeDisabled();
  await expect.poll(() => state.gifRequests.filter(request => request === `${key}:2`).length).toBe(1);
  state.delayMore = false;
  await expect(page.getByText(/현재 목록은 유지돼요/)).toBeVisible();
  await expect(list.locator(".gif-choice")).toHaveCount(24);
  state.failMore = false;
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(list.locator(".gif-choice")).toHaveCount(48);
  expect(state.gifRequests.filter(request => request === `${key}:2`)).toHaveLength(2);
  await page.getByRole("button", { name: "더 보기", exact: true }).click();
  await expect(list.locator(".gif-choice")).toHaveCount(72);
  await expect(page.getByRole("button", { name: "더 보기", exact: true })).toHaveCount(0);
});

test("query switch ignores late pagination from the previous search", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "GIF 검색" });
  await search.fill("cat");
  await expect(page.getByRole("button", { name: "cat-1-0 선택", exact: true })).toBeVisible();
  state.delayMore = true;
  await page.getByRole("button", { name: "더 보기", exact: true }).click();
  await search.fill("dog");
  await expect(page.getByRole("button", { name: "dog-1-0 선택", exact: true })).toBeVisible();
  state.delayMore = false;
  await expect(page.getByTestId("gif-results").locator(".gif-choice")).toHaveCount(24);
  await expect(page.getByRole("button", { name: /^cat-/ })).toHaveCount(0);
});

for (const width of [320, 1440]) test(`compose shares categories and frames, preserves photo and restores dialog focus at ${width}px`, async ({ page }, testInfo) => {
  await setup(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/compose");
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
  const photo = await page.getByAltText("my photo").getAttribute("src");
  await page.getByRole("button", { name: "GIF 고르기", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "GIF 고르기", exact: true });
  await sheet.getByRole("button", { name: "카테고리 선택", exact: true }).click();
  await page.getByRole("dialog", { name: "카테고리", exact: true }).getByRole("button", { name: "귀여워", exact: true }).click();
  await expect(sheet.getByRole("heading", { name: "귀여워 GIF" })).toBeVisible();
  await sheet.getByRole("button", { name: "카테고리 선택: 귀여워", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "카테고리 선택: 귀여워", exact: true })).toBeFocused();
  const choice = sheet.getByRole("button", { name: "aww-1-0 선택", exact: true });
  await choice.hover();
  await expect(choice.getByRole("status")).toHaveText("1프레임");
  await sheet.getByRole("button", { name: "더 보기", exact: true }).click();
  await expect(sheet.locator(".gif-choice")).toHaveCount(48);
  await page.screenshot({ path: `qa/first-experience/${testInfo.project.name}/compose-selector-${width}.png` });
  await choice.click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByAltText("my photo")).toHaveAttribute("src", photo!);
  const change = page.locator(".compose-gif").getByRole("button", { name: "바꾸기", exact: true });
  await expect(change).toBeFocused();
  await change.click();
  await sheet.getByRole("button", { name: "카테고리 선택", exact: true }).click();
  await page.getByRole("dialog", { name: "카테고리", exact: true }).getByRole("button", { name: "귀여워", exact: true }).click();
  await sheet.getByRole("button", { name: "aww-1-0 선택", exact: true }).click();
  await expect(page.getByAltText("selected gif")).toBeVisible();
  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("explorer_events")!)) as { name: string; data: { action?: string; surface?: string } }[];
  expect(events.filter(event => event.name === "gif_selection_changed" && event.data.surface === "compose" && event.data.action === "cleared")).toHaveLength(0);
  await change.click();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(change).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

test("direct accepted-job return is measured separately from a new compose entry", async ({ page }) => {
  const state = await setup(page);
  state.status = "COMPLETED";
  await page.goto("/compose?job=return-job");
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("explorer_events")!)) as { name: string; data: { flow_origin: string; experience_version: string } }[];
  expect(events.some(event => event.name === "compose_viewed")).toBe(false);
  expect(events.find(event => event.name === "composition_resume_opened")?.data.flow_origin).toBe("result_return");
  expect(events.find(event => event.name === "composition_job_status_viewed")?.data.experience_version).toBe("anonymous-first-v3");
});
