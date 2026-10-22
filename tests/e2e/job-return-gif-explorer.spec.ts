import { expect, test, type Page } from "@playwright/test";

const gif = (id: string) => ({ id, slug: id, title: id, blur_preview: "", file: {
  hd: { gif: { url: "/test-frame.gif", width: 320, height: 320, size: 1 } },
  md: { gif: { url: `/icon.png?gif=${id}`, width: 320, height: 320, size: 1 } }, sm: {}, xs: {},
} });

async function setup(page: Page) {
  const state = { submissions: 0, nextJobId: "return-job", sessions: 0, user: true, ownerId: "owner", status: "PENDING", access: 200,
    gifRequests: [] as string[], submittedGifUrls: [] as string[], failMore: false, delayMore: false, listRequests: 0, listFails: false };
  await page.addInitScript(() => {
    window.gifglooAnalytics = { get_property: () => sessionStorage.getItem("__analytics_user") ?? undefined, get_distinct_id: () => sessionStorage.getItem("__analytics_user") ?? "e2e-device", reset: () => sessionStorage.removeItem("__analytics_user"),  identify(userId: string) { sessionStorage.setItem("__analytics_user", userId); }, capture(name, data) {
      const events = JSON.parse(sessionStorage.getItem("explorer_events") ?? "[]");
      events.push({ name, data });
      sessionStorage.setItem("explorer_events", JSON.stringify(events));
    } };
  });
  await page.route("https://static.klipy.com/**", route => route.fulfill({ contentType: "image/png", path: "public/icon.png" }));
  await page.route("http://localhost:8000/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const job = { job_id: "return-job", status: state.status, stage: null,
      source_gif_url: "/icon.png", target_asset_id: null,
      result_url: state.status === "COMPLETED" ? "/icon.png" : null, result_asset_id: "result",
      created_at: "2026-10-09T00:00:00Z", credit_settlement: { balance_before: 20, charged: 10, refunded: 10, balance_after: 20 } };
    if (path === "/users/me") return route.fulfill(state.user ? { json: { user_id: state.ownerId, user_kind: "anonymous", consent_required: false } } : { status: 401, json: {} });
    if (path === "/users/anonymous-session") { state.sessions++; return route.fulfill({ status: 500, json: {} }); }
    if (path === "/credits/balance") return route.fulfill({ json: { balance: 20 - state.submissions * 10, remaining_uses: 2 - state.submissions, nearest_expires_at: null } });
    if (path === "/experiments/exp-001/survey") return route.fulfill({ json: { eligible: false, submitted: false } });
    if (path === "/web-push/config") return route.fulfill({ json: { enabled: false, public_key: null } });
    if (path === "/compositions/uploads") return route.fulfill({ json: { upload_id: "upload", upload_url: "http://localhost:8000/upload", headers: { "Content-Type": "image/png" } } });
    if (path === "/upload") return route.fulfill({ status: 200 });
    if (path === "/compositions/from-upload") { state.submittedGifUrls.push(route.request().postDataJSON().gif_url); state.submissions++; return route.fulfill({ json: { composition_job_id: state.nextJobId } }); }
    if (/^\/compositions\/return-job(?:-B)?\/status$/.test(path)) return route.fulfill(state.access === 200
      ? { contentType: "text/event-stream", body: `data: ${JSON.stringify(job)}\n\n` }
      : { status: state.access, json: {} });
    if (/^\/compositions\/return-job(?:-B)?$/.test(path)) return route.fulfill({ status: state.access, json: job });
    if (/^\/compositions\/return-job(?:-B)?\/feedback$/.test(path)) return route.fulfill({ json: { satisfied: null } });
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

async function submit(page: Page, expectedJobId = "return-job") {
  await page.goto("/");
  await page.getByRole("link", { name: "장면 찾기", exact: true }).click();
  await page.getByRole("button", { name: "trending-1-0 선택", exact: true }).click();
  await page.getByRole("group", { name: "선택한 GIF", exact: true }).getByRole("button", { name: "사진 고르기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await expect(page.getByAltText("my photo")).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
  await expect(page.getByAltText("my photo")).toBeVisible();
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/compose\\?job=${expectedJobId}$`));
}

test("accepted job survives My Results, browser back, reload and direct return without resubmission", async ({ page }) => {
  const state = await setup(page);
  await submit(page);
  await page.getByRole("link", { name: "내 결과", exact: true }).click();
  await expect(page.getByRole("button", { name: "진행 중인 작업 이어 보기" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/compose\?job=return-job$/);
  await expect(page.getByRole("heading", { name: "GIF를 만들고 있어요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "합성하기", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "GIF를 만들고 있어요" })).toBeVisible();
  state.status = "COMPLETED";
  await page.reload();
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  expect(state.submissions).toBe(1);
  expect(state.submittedGifUrls).toEqual(["/test-frame.gif"]);
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
    await expect(page.getByRole("heading", { name: "주인공으로 넣을 사진" })).toBeVisible();
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
  await page.getByRole("link", { name: "장면 찾기", exact: true }).click();
  if (source === "search") {
    const search = page.getByRole("searchbox", { name: "GIF 검색" });
    await search.fill("cat");
    await search.press("Enter");
  }
  if (source === "category") {
    await page.getByRole("navigation", { name: "GIF 분류" }).getByRole("button", { name: "동작", exact: true }).click();
    await page.getByRole("button", { name: "춤추기 GIF 둘러보기", exact: true }).click();
  }
  const key = source === "trending" ? "trending" : source === "search" ? "cat" : "dancing";
  await expect(page.getByRole("button", { name: `${key}-1-0 선택`, exact: true })).toBeVisible();
  const list = page.getByTestId("gif-results");
  await page.locator('[data-gif-scroll-container]').hover();
  await page.mouse.wheel(0, 10_000);
  await expect(page.getByRole("button", { name: "더 둘러보기", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(state.gifRequests.filter(request => request === `${key}:2`)).toHaveLength(0);
  state.failMore = true;
  state.delayMore = true;
  await page.getByRole("button", { name: "더 둘러보기", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByRole("button", { name: "불러오는 중…" })).toBeDisabled();
  await expect.poll(() => state.gifRequests.filter(request => request === `${key}:2`).length).toBe(1);
  state.delayMore = false;
  await expect(page.getByText(/현재 목록은 유지돼요/)).toBeVisible();
  await expect(list.locator(".gif-choice")).toHaveCount(24);
  state.failMore = false;
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(list.locator(".gif-choice")).toHaveCount(48);
  expect(state.gifRequests.filter(request => request === `${key}:2`)).toHaveLength(2);
  await page.getByRole("button", { name: "더 둘러보기", exact: true }).click();
  await expect(list.locator(".gif-choice")).toHaveCount(72);
  await expect(page.getByRole("button", { name: "더 둘러보기", exact: true })).toHaveCount(0);
});

test("query switch ignores late pagination from the previous search", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await page.getByRole("link", { name: "장면 찾기", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "GIF 검색" });
  await search.fill("cat");
  await search.press("Enter");
  await expect(page.getByRole("button", { name: "cat-1-0 선택", exact: true })).toBeVisible();
  state.delayMore = true;
  await page.getByRole("button", { name: "더 둘러보기", exact: true }).click();
  await search.fill("dog");
  await search.press("Enter");
  await expect(page.getByRole("button", { name: "dog-1-0 선택", exact: true })).toBeVisible();
  state.delayMore = false;
  await expect(page.getByTestId("gif-results").locator(".gif-choice")).toHaveCount(24);
  await expect(page.getByRole("button", { name: /^cat-/ })).toHaveCount(0);
});

for (const width of [320, 1440]) test(`changing scene stays in compose and retains the photo at ${width}px`, async ({ page }) => {
  const state = await setup(page);
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/?browse=1");
  await page.getByRole("button", { name: "trending-1-0 선택", exact: true }).click();
  await page.getByRole("group", { name: "선택한 GIF", exact: true }).getByRole("button", { name: "사진 고르기", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
  const photo = page.getByAltText("my photo");
  await expect(photo).toBeVisible();
  const photoUrl = await photo.getAttribute("src");
  const source = page.getByRole("group", { name: "선택한 원본 GIF", exact: true });
  const target = page.getByRole("group", { name: "주인공 사진", exact: true });
  const sourceBounds = await source.boundingBox();
  const targetBounds = await target.boundingBox();
  expect(targetBounds!.x).toBeGreaterThan(sourceBounds!.x + sourceBounds!.width);
  expect(targetBounds!.y).toBe(sourceBounds!.y);
  await page.getByRole("button", { name: "장면 바꾸기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "다른 장면 둘러보기", exact: false }).click();
  const sheet = page.getByRole("dialog", { name: "어떤 모습을 만들어볼까요?", exact: true });
  await expect(sheet.getByRole("group", { name: "추천 검색어" }).getByRole("button")).toHaveCount(6);
  await sheet.getByRole("button", { name: "건배", exact: true }).click();
  await sheet.getByRole("button", { name: "너를 위해 건배 선택", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(photo).toHaveAttribute("src", photoUrl!);
  await expect(source.locator("video")).toHaveAttribute("src", "/examples/scenes/gatsby-toast.mp4");
  await page.getByRole("button", { name: "사진 삭제", exact: true }).click();
  await page.getByRole("button", { name: "장면 바꾸기", exact: true }).click();
  await page.getByRole("button", { name: "다른 장면 둘러보기", exact: false }).click();
  await page.getByRole("button", { name: "쉴 틈 없는 타자 선택", exact: true }).click();
  await expect(photo).toHaveCount(0);
  await expect(page.getByRole("button", { name: "사진 넣기", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(state.submissions).toBe(0);
});

for (const width of [320, 1280]) test(`Korean initial suggestions include English guidance and submit the selected English query at ${width}px`, async ({ page }) => {
  const state = await setup(page);
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/?browse=1");
  const search = page.getByRole("searchbox", { name: "GIF 검색" });
  const suggestions = page.getByRole("group", { name: "연결할 수 있는 검색어", exact: true });
  await search.focus();
  await expect(suggestions).toBeHidden();
  for (const input of ["ㅇ", "ㅌ", "d", "담ㅂ"]) {
    await search.fill(input);
    await expect(suggestions).toBeVisible();
    await expect(suggestions.getByText("영어 키워드로 검색하면 더 다양한 짤을 찾기 좋아요.", { exact: true })).toBeVisible();
    expect(await suggestions.getByRole("button").count()).toBeGreaterThan(0);
    expect(await suggestions.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  }
  await search.fill("ㄷㅂ");
  await suggestions.getByRole("button", { name: "담배 피우기 smoking", exact: true }).click();
  await expect(page.getByRole("button", { name: "smoking-1-0 선택", exact: true })).toBeVisible();
  await expect(search).toHaveValue("담배 피우기");
  await expect(suggestions).toBeHidden();
  expect(state.gifRequests).toContain("smoking:1");
  expect(state.gifRequests.some(request => request.startsWith("ㄷㅂ:") || request.startsWith("담배 피우기:"))).toBe(false);
  await search.fill("ㅇ");
  await expect(suggestions).toBeVisible();
  await search.press("Escape");
  await expect(suggestions).toBeHidden();
  await search.fill("");
  await expect(suggestions).toBeHidden();
});

test("Korean topic help submits an English query and history back restores loaded browsing results", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await page.getByRole("link", { name: "장면 찾기", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "GIF 검색" });
  await search.fill("춤추기");
  await page.getByRole("group", { name: "연결할 수 있는 검색어", exact: true }).getByRole("button", { name: /춤추기/ }).click();
  await expect(page.getByRole("button", { name: "dancing-1-0 선택", exact: true })).toBeVisible();
  expect(state.gifRequests).toContain("dancing:1");
  expect(state.gifRequests.some(request => request.startsWith("춤추기:"))).toBe(false);
  await page.getByRole("button", { name: "더 둘러보기", exact: true }).click();
  const choices = page.getByTestId("gif-results").locator(".gif-choice");
  await expect(choices).toHaveCount(48);
  const choice = page.getByRole("button", { name: "dancing-2-20 선택", exact: true });
  await choice.scrollIntoViewIfNeeded();
  const scrollHost = page.locator('[data-gif-scroll-container]');
  const scrollBefore = await scrollHost.evaluate(element => element.scrollTop);
  expect(scrollBefore).toBeGreaterThan(0);
  await choice.click();
  const selection = page.getByRole("group", { name: "선택한 GIF", exact: true });
  const expand = selection.getByRole("button", { name: "선택한 GIF 크게 보기", exact: true });
  await expand.click();
  await page.getByRole("button", { name: "GIF 미리보기 닫기", exact: true }).click();
  await expect(expand).toBeFocused();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => scrollHost.evaluate(element => element.scrollTop)).toBe(scrollBefore);
  const requestCount = state.gifRequests.length;
  await selection.getByRole("button", { name: "사진 고르기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await expect(page.getByAltText("my photo")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/\?browse=1$/);
  await expect(choices).toHaveCount(48);
  await expect(choice).toBeVisible();
  await expect.poll(() => scrollHost.evaluate(element => element.scrollTop)).toBe(scrollBefore);
  expect(state.gifRequests).toHaveLength(requestCount);
});

test("direct accepted-job return is measured separately from a new compose entry", async ({ page }) => {
  const state = await setup(page);
  state.status = "COMPLETED";
  await page.goto("/compose?job=return-job");
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("explorer_events")!)) as { name: string; data: { flow_origin: string; experience_version: string } }[];
  expect(events.some(event => event.name === "compose_viewed")).toBe(false);
  expect(events.find(event => event.name === "composition_resume_opened")?.data.flow_origin).toBe("result_return");
  expect(events.find(event => event.name === "composition_job_status_viewed")?.data.experience_version).toBe("example-compose-v6");
});

test("a failed first search retries the same query instead of discarding the browsing intent", async ({ page }) => {
  await setup(page);
  let attempts = 0;
  await page.route("**/api/gif?**", route => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("q") !== "my unusual scene") return route.fallback();
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, json: {} });
    return route.fallback();
  });
  await page.goto("/?browse=1");
  const search = page.getByRole("searchbox", { name: "GIF 검색" });
  await search.fill("my unusual scene");
  await search.press("Enter");
  await expect(page.getByRole("button", { name: "다시 불러오기", exact: true })).toBeVisible();
  await expect(search).toHaveValue("my unusual scene");
  await page.getByRole("button", { name: "다시 불러오기", exact: true }).click();
  await expect(page.getByRole("button", { name: "my unusual scene-1-0 선택", exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});


test("accepted origin survives later attempts, reload, My Results and notification return; lost scope stays unknown", async ({ page, context }) => {
  const state = await setup(page);
  await page.route("http://localhost:8000/assets/result/download", route => route.fulfill({
    contentType: "image/gif", headers: { "Content-Disposition": "attachment; filename=result.gif" },
    body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
  }));
  await submit(page);
  const events = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("explorer_events") ?? "[]") as { name: string; data: Record<string, string> }[]);
  const accepted = (await events()).find(event => event.name === "composition_requested")!.data;
  expect(accepted.origin_linkage).toBe("known");
  expect(accepted.origin_attempt_id).toBe(accepted.attempt_id);
  expect(accepted.analytics_schema_version).toBe("2");
  state.status = "COMPLETED";
  await page.reload();
  await page.getByRole("button", { name: "다시 만들기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  state.nextJobId = "return-job-B";
  await submit(page, "return-job-B");
  const acceptedB = (await events()).find(event => event.name === "composition_requested" && event.data.job_id === "return-job-B")!.data;
  expect(acceptedB.attempt_id).not.toBe(accepted.attempt_id);
  expect(acceptedB.origin_attempt_id).toBe(acceptedB.attempt_id);
  expect(state.submissions).toBe(2);
  await page.goto("/compose?job=return-job");
  await page.getByRole("button", { name: "만족해요", exact: true }).click();
  await expect(page.getByRole("heading", { name: "평가해 주셔서 감사해요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "GIF 저장", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "GIF 저장", exact: true }).click();
  await page.goto("/my-assets");
  await page.getByRole("button", { name: "완성된 GIF 보기" }).click();
  await page.getByRole("button", { name: "GIF 저장", exact: true }).click();
  await page.getByRole("button", { name: "링크 복사", exact: true }).click();
  await page.goto("/my-assets?job=return-job&from=notification");
  await expect(page.getByRole("region", { name: "알림으로 돌아온 결과" })).toBeVisible();
  await page.getByRole("button", { name: "GIF 저장", exact: true }).click();
  const jobEvents = (await events()).filter(event => event.data.job_id === "return-job");
  expect(jobEvents.some(event => event.name === "completion_notification_opened")).toBe(true);
  expect(jobEvents.some(event => event.name === "composition_feedback_submitted")).toBe(true);
  expect(jobEvents.filter(event => event.name === "result_downloaded").map(event => event.data.source)).toEqual(["composition_result", "my_assets", "notification_return"]);
  for (const event of jobEvents) {
    expect(event.data.origin_flow_id).toBe(accepted.flow_id);
    expect(event.data.origin_attempt_id).toBe(accepted.attempt_id);
  }
  const download = jobEvents.find(event => event.name === "result_downloaded")!;
  expect(download.data.attempt_id).toBe(acceptedB.attempt_id);
  expect(jobEvents.find(event => event.name === "result_share_attempted")!.data.origin_linkage).toBe("known");
  await page.evaluate(() => sessionStorage.removeItem("gifgloo_job_origins"));
  await page.reload();
  await page.getByRole("button", { name: "GIF 저장", exact: true }).click();
  expect((await events()).filter(event => event.name === "result_downloaded").at(-1)!.data).toMatchObject({ origin_linkage: "unknown", job_id: "return-job" });
  expect((await events()).filter(event => event.name === "result_downloaded").at(-1)!.data).not.toHaveProperty("origin_attempt_id");
  const other = await context.newPage();
  await setup(other);
  await other.goto("/compose?job=return-job");
  await expect.poll(() => other.evaluate(() => JSON.parse(sessionStorage.getItem("explorer_events") ?? "[]").some((event: { name: string }) => event.name === "composition_job_status_viewed"))).toBe(true);
  const unknown = await other.evaluate(() => JSON.parse(sessionStorage.getItem("explorer_events")!)).then(events => events.find((event: { name: string }) => event.name === "composition_job_status_viewed").data);
  expect(unknown.origin_linkage).toBe("unknown");
  expect(unknown).not.toHaveProperty("origin_attempt_id");
});
