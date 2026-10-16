import { test, expect, type Page } from "@playwright/test";

async function setup(page: Page, userKind: "anonymous" | "member" = "anonymous") {
  const state = { uploads: 0, submissions: [] as { gif_url: string; upload_id: string }[], queries: [] as string[] };
  await page.route("https://cloud.umami.is/**", route => route.abort());
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await expect.poll(() => state.submissions, { timeout: 15_000 }).toEqual([{ gif_url: "/icon.png", upload_id: "example-upload", acknowledge_frame_reduction: false }]);
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
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
