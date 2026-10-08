import { expect, test, type Page } from "@playwright/test";

const gif = {
  id: "guest-gif", slug: "guest-gif", title: "Guest GIF", blur_preview: "",
  file: { hd: { gif: { url: "/icon.png", width: 320, height: 320, size: 1 } }, md: { gif: { url: "/icon.png", width: 320, height: 320, size: 1 } }, sm: {}, xs: {} },
};

async function setup(page: Page, mode: "normal" | "blocked" | "offline" = "normal", liveRun?: string) {
  const state = { sessionCalls: 0, consents: 0, uploads: 0, compositions: 0, shares: 0, surveys: 0, oauth: 0, submitted: false };
  let consentRequired = true;
  const userId = liveRun ? `qa-${liveRun}` : "guest-user";
  if (!liveRun) {
    await page.route("https://cloud.umami.is/**", (route) => route.abort());
    await page.addInitScript(() => {
      Object.assign(window, { umami: { identify: () => undefined, track: (name: string, data: unknown) => {
        const events = JSON.parse(sessionStorage.getItem("test_events") ?? "[]");
        events.push({ name, data }); sessionStorage.setItem("test_events", JSON.stringify(events));
      } } });
    });
  }
  // Unknown backend calls fail locally; tests must never contact a real synthesis service.
  await page.route("http://localhost:8000/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const cookies = await page.context().cookies("http://127.0.0.1:3100");
    const ready = cookies.some((cookie) => cookie.name === "guest_test_session");
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/users/me") return route.fulfill(mode === "offline"
      ? { status: 503, json: {} }
      : ready ? { json: { user_id: userId, user_kind: "anonymous", consent_required: consentRequired } } : { status: 401, json: {} });
    if (path === "/users/anonymous-session") {
      state.sessionCalls += 1;
      if (mode === "blocked" || state.sessionCalls === 1) return route.fulfill({ status: 202, json: { ready: false } });
      await page.context().addCookies([{ name: "guest_test_session", value: "yes", url: "http://127.0.0.1:3100" }]);
      return route.fulfill({ json: { ready: true, created: true, user_id: userId, user_kind: "anonymous", consent_required: consentRequired } });
    }
    if (path === "/users/me/consents") {
      state.consents += 1; consentRequired = false;
      return route.fulfill({ json: {} });
    }
    if (path === "/credits/balance") return route.fulfill({ json: { balance: state.submitted ? 20 : 20 - state.compositions * 10, remaining_uses: state.submitted ? 2 : 2 - state.compositions, nearest_expires_at: null } });
    if (path === "/experiments/exp-001/survey") {
      if (req.method() === "POST") { state.surveys += 1; state.submitted = true; return route.fulfill({ json: { submitted: true } }); }
      return route.fulfill({ json: { eligible: state.compositions > 0, submitted: state.submitted } });
    }
    if (path === "/compositions/uploads") {
      state.uploads += 1;
      return route.fulfill({ json: { upload_id: "guest-upload", upload_url: "http://localhost:8000/mock-upload", headers: { "Content-Type": "image/png" } } });
    }
    if (path === "/mock-upload") return route.fulfill({ status: 200 });
    if (path === "/compositions/from-upload") { state.compositions += 1; return route.fulfill({ json: { composition_job_id: `guest-job-${state.compositions}` } }); }
    if (/\/compositions\/guest-job-\d+\/status/.test(path)) return route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ status: "COMPLETED", stage: null, result_url: "/icon.png", result_asset_id: "guest-asset", failed_reason: null })}\n\n` });
    if (path === "/assets/guest-asset/share") { state.shares += 1; return route.fulfill({ json: { share_token: "public-guest-share" } }); }
    if (path === "/assets/guest-asset/download") return route.fulfill({ contentType: "image/gif", headers: { "Content-Disposition": 'attachment; filename="result.gif"' }, body: "GIF89a" });
    if (path === "/compositions") return route.fulfill({ json: { jobs: state.compositions ? [{ job_id: "guest-job-1", status: "COMPLETED", source_gif_url: "/icon.png", target_url: "/icon.png", result_url: "/icon.png", result_asset_id: "guest-asset", created_at: "2026-10-05T00:00:00Z" }] : [] } });
    if (path.startsWith("/oauth/")) state.oauth += 1;
    return route.fulfill({ status: 500, json: { message: `Unexpected mocked endpoint: ${path}` } });
  });
  await page.route("**/api/gif?**", (route) => route.fulfill({ json: { result: true, data: { data: [gif], current_page: 1, per_page: 12, has_next: false } } }));
  return state;
}

async function openFromHome(page: Page) {
  await page.goto("/?utm_source=youtube&utm_campaign=exp001_run01");
  await page.getByRole("button", { name: "Guest GIF 선택", exact: true }).click();
  await page.getByRole("button", { name: "이 GIF로 만들기" }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
}

async function recordedEvents(page: Page, name: string) {
  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]")) as { name: string; data: Record<string, unknown> }[];
  return events.filter(event => event.name === name).map(event => event.data);
}

test("anonymous home journey reaches result, download, link, retry and return without signup", async ({ page }) => {
  const state = await setup(page);
  await openFromHome(page);
  await expect(page.getByText("처음 이용할 때 한 번 확인해요")).toBeVisible();
  await expect(page.getByRole("button", { name: "만들기", exact: true })).toBeDisabled();
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByAltText("합성 결과")).toBeVisible();
  expect(state.consents).toBe(1);
  expect(state.sessionCalls).toBe(2);
  expect(state.compositions).toBe(1);
  await expect(page.locator("header").getByText("비회원 · 사용 가능 1회")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "GIF 저장", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("result.gif");
  await page.getByRole("button", { name: "링크 복사", exact: true }).click();
  await expect.poll(() => state.shares).toBe(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "다시 만들기" }).click();
  await expect(page.getByAltText("my photo")).toBeVisible();
  await expect(page.getByRole("button", { name: "만들기", exact: true })).toBeEnabled();
  await page.screenshot({ path: "test-results/anonymous-retry.png", fullPage: true });

  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]")) as { name: string; data: Record<string, unknown> }[];
  const funnel = ["home_viewed", "make_intent", "compose_viewed", "compose_inputs_ready", "compose_clicked", "composition_requested", "composition_result_viewed"];
  const stages = funnel.map((name) => events.find((event) => event.name === name)!);
  expect(stages.every(Boolean)).toBe(true);
  expect(new Set(stages.map((event) => event.data.flow_id)).size).toBe(1);
  expect(stages.every((event) => event.data.flow_origin === "home")).toBe(true);
  const indices = stages.map((event) => events.indexOf(event));
  expect(indices).toEqual([...indices].sort((a, b) => a - b));
  expect(JSON.stringify(events)).not.toContain("icon.png");
  expect(events.some((event) => event.name === "signup_completed")).toBe(false);
  expect(state.oauth).toBe(0);
  await page.goto("/my-assets");
  await page.getByAltText("합성 결과").click();
  await expect(page.getByRole("button", { name: "다운로드", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByAltText("합성 결과")).toBeVisible();
  expect(state.sessionCalls).toBe(2);
});

test("anonymous survey reward is available after completion and stays submitted on return", async ({ page }) => {
  const state = await setup(page);
  await openFromHome(page);
  await expect(page.getByRole("checkbox")).toHaveCount(4);
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByAltText("합성 결과")).toBeVisible();
  await page.getByRole("link", { name: "내 결과", exact: true }).click();
  await page.locator("header").getByRole("button", { name: "사용횟수 더 받기", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "설문 시작" }).click();
  await dialog.getByLabel("그냥 궁금해서", { exact: true }).check();
  await dialog.getByLabel("단체 채팅방에 보냈다", { exact: true }).check();
  await dialog.getByRole("button", { name: "제출하고 이용권 1회 받기" }).click();
  await expect(dialog.getByText("이용권 1회가 지급됐어요")).toBeVisible();
  await expect(page.locator("header").getByText("비회원 · 사용 가능 2회")).toBeVisible();
  expect(state.surveys).toBe(1);
  await page.reload();
  await expect(page.locator("header").getByRole("button", { name: "계정 연결" })).toBeVisible();
  await expect(page.locator("header").getByRole("button", { name: "사용횟수 더 받기", exact: true })).toHaveCount(0);
  expect(state.sessionCalls).toBe(2);
});

test("mobile anonymous input and account-link explanation remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await openFromHome(page);
  await expect(page.locator("header").getByRole("link", { name: "내 결과" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "test-results/anonymous-mobile.png", fullPage: true });
  await page.locator("header").getByRole("link", { name: "내 결과" }).click();
  await page.locator("header").getByRole("button", { name: "계정 연결" }).click();
  await expect(page.getByRole("dialog").getByText(/기존 계정으로 로그인하면 그 계정으로 전환/)).toBeVisible();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
});

test("direct compose entry is not classified as a home funnel", async ({ page }) => {
  await setup(page);
  await page.goto("/compose");
  await expect(page.getByText("처음 이용할 때 한 번 확인해요")).toBeVisible();
  const events = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test_events") ?? "[]")) as { name: string; data: Record<string, unknown> }[];
  expect(events.find((event) => event.name === "compose_viewed")?.data.flow_origin).toBe("direct_compose");
  expect(events.some((event) => event.name === "home_viewed")).toBe(false);
});

for (const mode of ["blocked", "offline"] as const) {
  test(`${mode} session keeps selected inputs, never sends synthesis or opens login`, async ({ page }) => {
    const state = await setup(page, mode);
    await openFromHome(page);
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await expect(page.getByAltText("my photo")).toBeVisible();
    await expect(page.getByRole("button", { name: "만들기", exact: true })).toBeDisabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(state.sessionCalls).toBe(mode === "blocked" ? 2 : 0);
    expect(state.compositions).toBe(0);
    expect(state.uploads).toBe(0);
  });
}

test("both GIF clear controls record one selection change without make intent", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  const tile = page.getByRole("button", { name: "Guest GIF 선택", exact: true });
  await tile.click();
  await page.getByRole("button", { name: "GIF 선택 취소", exact: true }).click();
  await expect(page.locator(".selection-bar")).toHaveCount(0);
  await tile.click();
  await tile.click();
  const changes = await recordedEvents(page, "gif_selection_changed");
  expect(changes.map(event => event.action)).toEqual(["selected", "cleared", "selected", "cleared"]);
  expect(changes.filter(event => event.action === "cleared").map(event => event.control)).toEqual(["selection_bar", "gif_tile"]);
  expect(new Set(changes.map(event => event.flow_id)).size).toBe(1);
  expect(changes.every(event => event.source === "trending")).toBe(true);
  expect(await recordedEvents(page, "make_intent")).toHaveLength(0);
});

test("consent tracks aggregate readiness only and distinguishes saving from checking", async ({ page }) => {
  await setup(page);
  await openFromHome(page);
  await expect.poll(() => recordedEvents(page, "compose_consent_state")).toMatchObject([{ required: true, ready: false }]);
  await page.getByRole("checkbox", { name: /만 14세 이상/ }).check();
  await page.getByRole("checkbox", { name: /이용약관/ }).check();
  expect(await recordedEvents(page, "compose_consent_state")).toHaveLength(1);
  expect(await recordedEvents(page, "compose_consent_save")).toHaveLength(0);
  await page.getByRole("checkbox", { name: /개인정보처리방침/ }).check();
  await expect.poll(async () => (await recordedEvents(page, "compose_consent_state")).at(-1)).toMatchObject({ required: true, ready: true });
  await page.getByRole("checkbox", { name: /이용약관/ }).uncheck();
  await expect(page.getByRole("button", { name: "만들기", exact: true })).toBeDisabled();
  await page.getByRole("checkbox", { name: "전체 동의", exact: true }).check();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByAltText("합성 결과")).toBeVisible();
  const consentStates = await recordedEvents(page, "compose_consent_state");
  expect(consentStates.map(({ required, ready }) => ({ required, ready }))).toEqual([
    { required: true, ready: false }, { required: true, ready: true },
    { required: true, ready: false }, { required: true, ready: true },
    { required: false, ready: true },
  ]);
  const saves = await recordedEvents(page, "compose_consent_save");
  expect(saves.map(event => event.status)).toEqual(["started", "success"]);
  expect(saves[1].http_status).toBe(200);
  const accepted = (await recordedEvents(page, "composition_requested"))[0];
  expect(saves.every(event => event.attempt_id === accepted.attempt_id)).toBe(true);
  expect(JSON.stringify([...consentStates, ...saves])).not.toMatch(/is_fourteen|terms_version|privacy_version|icon\.png/);
});

test("already consented session is ready without a new consent save", async ({ page }) => {
  const state = await setup(page);
  await page.route("http://localhost:8000/users/me", route => route.fulfill({ json: { user_id: "returning-guest", user_kind: "anonymous", consent_required: false } }));
  await openFromHome(page);
  await expect.poll(() => recordedEvents(page, "compose_consent_state")).toMatchObject([{ required: false, ready: true }]);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByAltText("합성 결과")).toBeVisible();
  expect(state.consents).toBe(0);
  expect(await recordedEvents(page, "compose_consent_save")).toHaveLength(0);
  expect((await recordedEvents(page, "compose_consent_state")).map(({ required, ready }) => ({ required, ready })))
    .toEqual([{ required: false, ready: true }]);
});

for (const failure of ["http", "network"] as const) test(`consent ${failure} failure is recorded before upload and a retry can succeed`, async ({ page }) => {
  const state = await setup(page);
  let failSave = true;
  await page.route("http://localhost:8000/users/me/consents", route => {
    if (!failSave) return route.fallback();
    return failure === "http" ? route.fulfill({ status: 503, json: {} }) : route.abort("failed");
  });
  await openFromHome(page);
  await page.getByRole("checkbox", { name: "전체 동의", exact: true }).check();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByAltText("my photo")).toBeVisible();
  const saves = await recordedEvents(page, "compose_consent_save");
  expect(saves.map(event => event.status)).toEqual(["started", "error"]);
  expect(saves[1]).toMatchObject(failure === "http" ? { http_status: 503 } : { reason: "network" });
  expect(state.uploads).toBe(0);
  expect(state.compositions).toBe(0);
  expect(await recordedEvents(page, "composition_failed")).toHaveLength(0);
  failSave = false;
  await page.getByRole("button", { name: "접속 다시 확인" }).click();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByAltText("합성 결과")).toBeVisible();
  const retriedSaves = await recordedEvents(page, "compose_consent_save");
  expect(retriedSaves.map(event => event.status)).toEqual(["started", "error", "started", "success"]);
  expect(retriedSaves[2].attempt_id).not.toBe(saves[0].attempt_id);
});

for (const action of ["cancel_button", "cancel_backdrop", "confirm"] as const) test(`frame reduction ${action} is a conditional branch in the same attempt`, async ({ page }) => {
  await setup(page);
  const acknowledgements: boolean[] = [];
  const message = "GIF가 40프레임입니다. 20프레임으로 줄여서 진행됩니다.";
  await page.route("http://localhost:8000/compositions/from-upload", route => {
    const acknowledged = route.request().postDataJSON().acknowledge_frame_reduction;
    acknowledgements.push(acknowledged);
    if (acknowledged) return route.fallback();
    return route.fulfill({ status: 422, json: { error: "CONFIRMATION_REQUIRED", code: "FRAME_REDUCTION_REQUIRED", message, proposal: { frame_count: 40, max_frames: 20 } } });
  });
  await openFromHome(page);
  await page.getByRole("checkbox", { name: "전체 동의", exact: true }).check();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  const steps = await recordedEvents(page, "composition_request_step");
  expect(steps.filter(event => event.phase === "submit").map(event => event.status)).toEqual(["started", "confirmation_required"]);
  expect(await recordedEvents(page, "composition_requested")).toHaveLength(0);
  if (action === "confirm") {
    await page.getByRole("button", { name: "네, 진행할게요", exact: true }).click();
    await expect(page.getByAltText("합성 결과")).toBeVisible();
    expect(acknowledgements).toEqual([false, true]);
    const newSteps = await recordedEvents(page, "composition_request_step");
    expect(newSteps.some(event => event.phase === "upload" && event.status === "cache_reused")).toBe(true);
    expect(newSteps.filter(event => event.phase === "submit").map(event => event.status)).toEqual(["started", "confirmation_required", "started", "success"]);
  } else {
    if (action === "cancel_button") await page.getByRole("button", { name: "취소", exact: true }).click();
    else await page.getByText(message, { exact: true }).locator("../..").click({ position: { x: 4, y: 4 } });
    await expect(page.getByText(message, { exact: true })).toHaveCount(0);
    await expect(page.getByAltText("my photo")).toBeVisible();
    expect(acknowledgements).toEqual([false]);
    expect(await recordedEvents(page, "composition_requested")).toHaveLength(0);
  }
  const branch = await recordedEvents(page, "composition_frame_confirmation");
  expect(branch.map(event => event.action)).toEqual(["opened", action === "confirm" ? "confirmed" : "cancelled"]);
  if (action !== "confirm") expect(branch[1].method).toBe(action === "cancel_button" ? "button" : "backdrop");
  const clicks = await recordedEvents(page, "compose_clicked");
  expect(clicks).toHaveLength(1);
  expect(branch.every(event => event.attempt_id === clicks[0].attempt_id && event.flow_id === clicks[0].flow_id)).toBe(true);
  if (action === "confirm") expect((await recordedEvents(page, "composition_requested"))[0].attempt_id).toBe(clicks[0].attempt_id);
  expect(await recordedEvents(page, "composition_failed")).toHaveLength(0);
});

test("unrelated 422 remains an error rather than a frame confirmation", async ({ page }) => {
  await setup(page);
  await page.route("http://localhost:8000/compositions/from-upload", route => route.fulfill({ status: 422, json: { detail: "invalid input" } }));
  await openFromHome(page);
  await page.getByRole("checkbox", { name: "전체 동의", exact: true }).check();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "작업에 실패했습니다" })).toBeVisible();
  const steps = await recordedEvents(page, "composition_request_step");
  expect(steps.filter(event => event.phase === "submit").map(event => event.status)).toEqual(["started", "error"]);
  expect(await recordedEvents(page, "composition_frame_confirmation")).toHaveLength(0);
});

test("live Umami receives the internal QA journey and corrected branches", async ({ page }, testInfo) => {
  test.skip(process.env.LIVE_UMAMI !== "true", "Explicit opt-in: sends internal QA events to the configured Umami website.");
  const run = `qa_measurement_${Date.now()}`;
  const rejected: string[] = [];
  const receipts: { name: string; data: Record<string, unknown>; status: number; disabled: boolean }[] = [];
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:3100" || url.href === "https://cloud.umami.is/script.js") return route.continue();
    // Backend routes installed below fulfill locally; no other remote service is allowed.
    return route.abort();
  });
  await page.route("https://gateway.umami.is/api/send", route => {
    const body = route.request().postDataJSON();
    const payload = body.payload;
    if (payload.hostname !== "127.0.0.1" || (payload.name && payload.data?.traffic_type !== "internal")) {
      rejected.push(payload.name ?? body.type);
      return route.abort();
    }
    return route.continue();
  });
  page.on("response", async response => {
    if (response.url() !== "https://gateway.umami.is/api/send" || response.request().method() !== "POST") return;
    const payload = response.request().postDataJSON().payload;
    if (!payload.name) return;
    const result = await response.json();
    receipts.push({ name: payload.name, data: payload.data, status: response.status(), disabled: result.disabled === true });
  });
  await setup(page, "normal", run);
  let consentFailed = false;
  await page.route("http://localhost:8000/users/me/consents", route => {
    if (consentFailed) return route.fallback();
    consentFailed = true;
    return route.fulfill({ status: 503, json: {} });
  });
  const message = "GIF가 40프레임입니다. 20프레임으로 줄여서 진행됩니다.";
  await page.route("http://localhost:8000/compositions/from-upload", route => {
    if (route.request().postDataJSON().acknowledge_frame_reduction) return route.fallback();
    return route.fulfill({ status: 422, json: { error: "CONFIRMATION_REQUIRED", code: "FRAME_REDUCTION_REQUIRED", message, proposal: { frame_count: 40, max_frames: 20 } } });
  });
  await page.goto(`/?utm_source=internal_qa&utm_campaign=${run}`);
  await page.getByRole("button", { name: "Guest GIF 선택", exact: true }).click();
  await page.getByRole("button", { name: "GIF 선택 취소", exact: true }).click();
  await page.getByRole("button", { name: "Guest GIF 선택", exact: true }).click();
  await page.getByRole("button", { name: "이 GIF로 만들기" }).click();
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
  await page.getByRole("checkbox", { name: "전체 동의", exact: true }).check();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "접속 다시 확인" }).click();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await page.getByRole("button", { name: "네, 진행할게요", exact: true }).click();
  await expect(page.getByAltText("합성 결과")).toBeVisible();
  await expect.poll(() => receipts.map(event => event.name), { timeout: 20_000 }).toContain("composition_result_viewed");
  await expect.poll(() => receipts.filter(event => event.name === "composition_frame_confirmation").length).toBe(4);
  expect(rejected).toEqual([]);
  expect(receipts.every(event => event.status === 200 && !event.disabled)).toBe(true);
  expect(receipts.every(event => event.data.traffic_type === "internal" && event.data.utm_campaign === run)).toBe(true);
  const funnel = ["home_viewed", "make_intent", "compose_viewed", "compose_inputs_ready", "compose_clicked", "composition_requested", "composition_result_viewed"];
  expect(funnel.every(name => receipts.some(event => event.name === name))).toBe(true);
  expect(new Set(receipts.map(event => event.data.flow_id)).size).toBe(1);
  expect(receipts.some(event => event.name === "gif_selection_changed" && event.data.control === "selection_bar" && event.data.action === "cleared")).toBe(true);
  expect(receipts.filter(event => event.name === "compose_consent_save").map(event => event.data.status)).toEqual(expect.arrayContaining(["error", "success"]));
  expect(receipts.some(event => event.name === "composition_request_step" && event.data.status === "confirmation_required")).toBe(true);
  await testInfo.attach("umami-receipts", { body: JSON.stringify({ run, receipts }, null, 2), contentType: "application/json" });
  console.log(JSON.stringify({ run, flow_id: receipts[0].data.flow_id, acceptedEvents: receipts.length, allInternal: true }));
});
