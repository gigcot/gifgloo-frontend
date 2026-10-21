import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function setup(page: Page, userKind: "anonymous" | "member" = "anonymous") {
  const state = { uploads: 0, submissions: [] as { gif_url: string; upload_id: string }[], queries: [] as string[] };
  await page.addInitScript(() => {
    Object.assign(window, { gifglooAnalytics: { get_property: () => sessionStorage.getItem("__analytics_user") ?? undefined, get_distinct_id: () => sessionStorage.getItem("__analytics_user") ?? "e2e-device", reset: () => sessionStorage.removeItem("__analytics_user"),
      identify: (userId: string) => sessionStorage.setItem("__analytics_user", userId),
      capture: (name: string, data: Record<string, unknown>) => {
        const events = JSON.parse(sessionStorage.getItem("test_events") ?? "[]");
        events.push({ name, data });
        sessionStorage.setItem("test_events", JSON.stringify(events));
      },
    } });
  });
  await page.route("https://static.klipy.com/**", route => route.fulfill({ path: "public/icon.png", contentType: "image/png" }));
  await page.route("http://localhost:8000/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (path === "/users/me") return route.fulfill({ json: { user_id: "example-tester", user_kind: userKind, consent_required: false } });
    if (path === "/credits/balance") return route.fulfill({ json: { balance: 20, remaining_uses: 2, nearest_expires_at: null } });
    if (path === "/experiments/exp-001/survey") return route.fulfill({ json: { eligible: false, submitted: false } });
    if (path === "/compositions/uploads") { state.uploads++; return route.fulfill({ json: { upload_id: "example-upload", upload_url: "http://localhost:8000/test-upload", headers: { "Content-Type": "image/png" } } }); }
    if (path === "/test-upload") return route.fulfill({ status: 200 });
    if (path === "/compositions/from-upload") { state.submissions.push(request.postDataJSON()); return route.fulfill({ json: { composition_job_id: "example-job" } }); }
    if (path === "/compositions/example-job/status") return route.fulfill({ contentType: "text/event-stream", body: 'data: {"status":"COMPLETED","result_url":"/icon.png","result_asset_id":"example-result"}\n\n' });
    if (path === "/compositions/example-job/feedback") return route.fulfill({ json: { satisfied: null } });
    if (path === "/compositions") return route.fulfill({ json: { jobs: [] } });
    return route.fulfill({ status: 500, json: { message: "Unexpected mocked endpoint: " + path } });
  });
  await page.route("**/api/gif?**", route => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    state.queries.push(query);
    const format = { url: "/icon.png", width: 256, height: 256, size: 100 };
    return route.fulfill({ json: { result: true, data: { data: [{ id: 301, slug: "remote-scene", title: "검색으로 찾은 장면", blur_preview: "", file: { hd: { gif: format }, md: { gif: format }, sm: { gif: format }, xs: {} } }], current_page: 1, has_next: false } } });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  return state;
}

async function lastEvent(page: Page, name: string) {
  return page.evaluate(eventName => JSON.parse(sessionStorage.getItem("test_events") ?? "[]")
    .filter((event: { name: string }) => event.name === eventName).at(-1)?.data, name);
}

for (const [example, advances, scene, target] of [
  ["dog-typing", 0, "cat-typing", "dog-typing-target.png"],
  ["face-online", 3, "face-online", "face-online-v2-target.png"],
  ["cat-running", 7, "cat-running", "cat-running-target.png"],
] as const) test(`the currently viewed ${example} carries its scene and keeps its photo and result as an optional reference`, async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  const next = page.getByRole("button", { name: "다음 슬라이드", exact: true });
  for (let i = 0; i < advances; i++) await next.click();
  await expect(page.locator("[data-story]")).toHaveAttribute("data-story", example);
  const resultSrc = await page.locator("[data-story] video").first().getAttribute("src");
  await page.getByRole("button", { name: "나도 만들어볼래요!", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/compose\\?example=" + example + "$"));
  await expect(page.getByRole("group", { name: "선택한 원본 GIF" }).locator("video")).toHaveAttribute("src", "/examples/scenes/" + scene + ".mp4");
  await expect(page.getByRole("group", { name: "주인공 사진" }).locator("img")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "예시 조합 안내" })).toHaveCount(0);
  await expect(page.locator("details video")).toHaveCount(0);
  await page.getByText("완성 예시 보기", { exact: true }).click();
  await expect(page.getByAltText("예시에 쓰인 사진")).toHaveAttribute("src", "/examples/onboarding/" + target);
  await expect(page.locator("details video")).toHaveAttribute("src", resultSrc!);
  await expect(page.getByRole("button", { name: "합성하기", exact: true })).toHaveCount(0);
  expect(state.uploads).toBe(0);
  expect(state.submissions).toHaveLength(0);
});

for (const [width, userKind] of [[320, "anonymous"], [393, "anonymous"], [1280, "anonymous"], [320, "member"]] as const) test(`example, keyword search, photo preservation and submission at ${width}px for ${userKind}`, async ({ page }) => {
  const state = await setup(page, userKind);
  await page.setViewportSize({ width, height: width === 320 ? 667 : 844 });
  await page.goto("/compose?example=face-online");
  await expect(page.getByRole("group", { name: "주인공 사진" }).locator("img")).toHaveCount(0);
  await expect(page.locator("header").getByText(userKind === "anonymous" ? "비회원 · 사용 가능 2회" : "사용 가능 2회")).toBeVisible();
  for (const label of ["장면 바꾸기", "사진 넣기"]) {
    const control = page.getByRole("button", { name: label, exact: true });
    await expect(control).toBeInViewport();
    const bounds = (await control.boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThan(page.viewportSize()!.height);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `qa/example-compose/entry-${width}-${userKind}.png` });
  await page.getByRole("button", { name: "예시 사진 써보기", exact: true }).click();
  await expect(page.getByAltText("my photo")).toBeVisible();
  const photo = await page.getByAltText("my photo").getAttribute("src");
  expect(state.uploads).toBe(0);
  const notice = page.getByRole("region", { name: "예시 조합 안내" });
  await expect(notice).toContainText("이용권 1회를 사용해요");
  await expect(notice).not.toContainText("무료");
  await notice.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({ path: `qa/example-compose/notice-${width}-${userKind}.png`, fullPage: true });
  await page.locator("header").getByRole("button", { name: "장면 찾기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose\?example=face-online$/);
  const sheet = page.getByRole("dialog", { name: "어떤 모습을 만들어볼까요?", exact: true });
  await expect(sheet.getByRole("group", { name: "추천 검색어" }).getByRole("button")).toHaveCount(6);
  await expect(sheet.getByLabel("장면 미리보기").getByRole("button")).toHaveCount(4);
  await sheet.getByRole("button", { name: "건배", exact: true }).click();
  await expect(sheet.getByLabel("장면 미리보기").getByRole("button")).toHaveCount(1);
  await page.screenshot({ path: `qa/example-compose/keyword-${width}.png`, fullPage: true });
  await sheet.getByRole("button", { name: "‘건배’ 장면 더 찾아보기 →", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "GIF 검색" })).toHaveValue("gatsby toast");
  await expect.poll(() => state.queries.includes("gatsby toast")).toBe(true);
  await page.getByRole("button", { name: "검색으로 찾은 장면 미리보기", exact: true }).click();
  await page.getByRole("dialog", { name: "대상을 바꿔볼까요?" }).getByRole("button", { name: "바꿔볼래요", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByAltText("my photo")).toHaveAttribute("src", photo!);
  await expect(page.getByAltText("selected gif")).toHaveAttribute("src", "/icon.png");
  await expect(notice).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await expect.poll(() => state.submissions, { timeout: 15_000 }).toEqual([{ gif_url: "/icon.png", upload_id: "example-upload", acknowledge_frame_reduction: false }]);
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  await expect.poll(() => lastEvent(page, "composition_requested")).toMatchObject({
    example: "face-online", photo_source: "example", photo_example: "face-online",
    scene_matches_example: false, is_example_pair: false,
  });
});

test("the approved example submits its public source GIF only after an explicit make action", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/compose?example=face-online");
  await page.getByRole("button", { name: "예시 사진 써보기", exact: true }).click();
  await expect(page.getByAltText("my photo")).toBeVisible();
  expect(state.uploads).toBe(0);
  expect(state.submissions).toHaveLength(0);
  const sourceUrl = new URL("/examples/onboarding/face-online-source.gif", page.url()).href;
  const source = await page.request.get(sourceUrl);
  expect(source.ok()).toBe(true);
  expect((await source.body()).subarray(0, 6).toString()).toMatch(/^GIF8[79]a$/);
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await expect.poll(() => state.submissions, { timeout: 15_000 }).toEqual([{ gif_url: sourceUrl, upload_id: "example-upload", acknowledge_frame_reduction: false }]);
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  const ready = await lastEvent(page, "compose_inputs_ready");
  for (const name of ["compose_inputs_ready", "compose_clicked", "composition_requested"]) {
    await expect.poll(() => lastEvent(page, name)).toMatchObject({
      example: "face-online", photo_source: "example", photo_example: "face-online",
      scene_matches_example: true, is_example_pair: true, flow_id: ready.flow_id,
      input_revision: ready.input_revision,
    });
  }
  expect((await lastEvent(page, "composition_requested")).attempt_id).toBe((await lastEvent(page, "compose_clicked")).attempt_id);
  expect(ready.input_revision).not.toBe("unready");
});

test("example pair notice follows material changes without guessing uploaded files", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/compose?example=face-online");
  const notice = page.getByRole("region", { name: "예시 조합 안내" });
  const input = page.getByLabel("합성할 사진", { exact: true });
  await expect(notice).toHaveCount(0);
  await page.getByRole("button", { name: "예시 사진 써보기", exact: true }).click();
  await expect(notice).toBeVisible();
  const originalRevision = (await lastEvent(page, "compose_inputs_ready")).input_revision;

  const chooser = page.waitForEvent("filechooser");
  await notice.getByRole("button", { name: "사진 바꾸기", exact: true }).click();
  await chooser;
  await input.dispatchEvent("cancel");
  await expect(notice).toBeVisible();
  await input.setInputFiles({ name: "invalid.txt", mimeType: "text/plain", buffer: Buffer.from("invalid") });
  await expect(page.locator("main").getByRole("alert")).toContainText("이미지 파일만");
  await expect(notice).toBeVisible();
  await expect.poll(() => lastEvent(page, "photo_change_clicked")).toMatchObject({ control: "example_pair_notice" });

  await notice.getByRole("button", { name: "장면 바꾸기", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "어떤 모습을 만들어볼까요?", exact: true });
  await sheet.getByRole("button", { name: "건배", exact: true }).click();
  await sheet.getByRole("button", { name: "너를 위해 건배", exact: false }).click();
  await expect(notice).toHaveCount(0);
  await expect.poll(() => lastEvent(page, "scene_picker_opened")).toMatchObject({ control: "example_pair_notice" });
  await expect.poll(() => lastEvent(page, "compose_inputs_ready")).toMatchObject({ photo_source: "example", scene_matches_example: false, is_example_pair: false });
  expect((await lastEvent(page, "compose_inputs_ready")).input_revision).not.toBe(originalRevision);
  await page.getByRole("button", { name: "장면 바꾸기", exact: true }).click();
  await page.getByRole("button", { name: "다른 장면 둘러보기", exact: false }).click();
  await sheet.getByRole("button", { name: "접속", exact: true }).click();
  await sheet.getByRole("button", { name: "나 접속했다", exact: false }).click();
  await expect(notice).toBeVisible();

  await input.setInputFiles({ name: "face-online-example.png", mimeType: "image/png", buffer: await readFile("public/examples/onboarding/face-online-v2-target.png") });
  await expect(notice).toHaveCount(0);
  await expect.poll(() => lastEvent(page, "compose_inputs_ready")).toMatchObject({ photo_source: "upload", photo_example: "none", scene_matches_example: true, is_example_pair: false });
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  await expect.poll(() => lastEvent(page, "composition_requested")).toMatchObject({ photo_source: "upload", is_example_pair: false });
  expect(state.submissions).toHaveLength(1);
  expect(JSON.stringify(await lastEvent(page, "composition_requested"))).not.toContain("face-online-example.png");
});

for (const outcome of ["completed", "failed"] as const) test(`example photo provenance survives ${outcome} and a retry without the example URL`, async ({ page }) => {
  const state = await setup(page);
  if (outcome === "failed") await page.route("**/compositions/example-job/status", route => route.fulfill({
    contentType: "text/event-stream", body: 'data: {"status":"FAILED","reason":"합성 실패"}\n\n',
  }));
  await page.goto("/compose?example=face-online");
  await page.getByRole("button", { name: "예시 사진 써보기", exact: true }).click();
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose\?job=example-job$/);
  await page.getByRole("button", { name: outcome === "completed" ? "다시 만들기" : "다시 시도", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByRole("region", { name: "예시 조합 안내" })).toBeVisible();
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await expect.poll(() => state.submissions.length).toBe(2);
  await expect.poll(() => lastEvent(page, "composition_requested")).toMatchObject({ example: "face-online", photo_source: "example", is_example_pair: true });
});

test("closing scene selection and a failed sample photo leave inputs usable", async ({ page }) => {
  const state = await setup(page);
  await page.route("**/face-online-v2-target.png", route => route.fulfill({ status: 503 }));
  await page.goto("/compose?example=face-online");
  await page.getByRole("button", { name: "예시 사진 써보기", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("예시 사진을 불러오지 못했어요");
  await expect(page.getByRole("button", { name: "사진 넣기" })).toBeEnabled();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "사진 넣기", exact: true }).click();
  await (await chooser).setFiles("public/icon.png");
  await expect(page.getByAltText("my photo")).toBeVisible();
  await page.getByRole("button", { name: "장면 바꾸기", exact: true }).click();
  await page.getByRole("button", { name: "다른 장면 둘러보기", exact: false }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByAltText("my photo")).toBeVisible();
  expect(state.submissions).toHaveLength(0);
});
