import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const assets = "/examples/hippo-pets/";
const gif = { id: "hippo", slug: "hippo", title: "물 맞는 하마", blur_preview: "", file: {
  hd: { gif: { url: "/frame.gif", width: 1, height: 1, size: 1 } },
  md: { gif: { url: `${assets}hippo-still.png`, width: 320, height: 320, size: 1 } },
  sm: { gif: { url: `${assets}hippo-still.png`, width: 320, height: 320, size: 1 } }, xs: {},
} };

async function setup(page: Page, permission: "granted" | "denied" = "granted", registrationFails = false) {
  const state = { subscriptions: 0, requests: 0, accept: true };
  await page.route("https://cloud.umami.is/**", route => route.abort());
  await page.route("https://static.klipy.com/**", route => route.fulfill({ contentType: "image/png", path: "public/icon.png" }));
  await page.route("http://localhost:8000/**", async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (pathname === "/users/me") return route.fulfill({ json: { user_id: "guest", user_kind: "anonymous", consent_required: false } });
    if (pathname === "/credits/balance") return route.fulfill({ json: { balance: (2 - state.requests) * 10, remaining_uses: 2 - state.requests, nearest_expires_at: null } });
    if (pathname === "/experiments/exp-001/survey") return route.fulfill({ json: { eligible: false, submitted: false } });
    if (pathname === "/compositions/uploads") return route.fulfill({ json: { upload_id: "upload", upload_url: "http://localhost:8000/upload", headers: { "Content-Type": "image/jpeg" } } });
    if (pathname === "/upload") return route.fulfill({ status: 200 });
    if (pathname === "/compositions/from-upload") {
      state.requests += 1;
      while (!state.accept) await new Promise(resolve => setTimeout(resolve, 20));
      return route.fulfill({ json: { composition_job_id: "job-v2" } });
    }
    if (pathname === "/web-push/config") return route.fulfill({ json: { enabled: true, public_key: "AAAA" } });
    if (pathname === "/compositions/job-v2/notification") { state.subscriptions += 1; return route.fulfill({ status: registrationFails ? 503 : 200, json: { status: "pending" } }); }
    if (pathname === "/compositions/job-v2") return route.fulfill({ json: { status: "COMPLETED", result_url: assets + "dog-result-still.png", result_asset_id: "result-v2" } });
    if (pathname === "/compositions") return route.fulfill({ json: { jobs: [] } });
    if (pathname === "/assets/result-v2/share") return route.fulfill({ json: { share_token: "shared-v2" } });
    if (pathname === "/compositions/job-v2/feedback") return route.fulfill(request.method() === "GET" ? { json: { satisfied: null } } : { status: 204 });
    return route.fulfill({ status: 500, json: { message: "Unexpected test endpoint" } });
  });
  await page.route("**/api/gif?**", route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: params.get("type") === "categories" ? { result: true, data: { locale: "ko_KR", categories: [
      { category: "안녕", query: "hello" }, { category: "귀여워", query: "aww" }, { category: "졸려", query: "sleepy" },
    ] } } : { result: true, data: { data: [gif, { ...gif, id: "second", title: "두 번째 GIF" }], current_page: 1, has_next: false } } });
  });
  const still = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
  await page.context().route("**/frame.gif", route => route.fulfill({ contentType: "image/gif", body: Buffer.concat([still.subarray(0, 19), ...Array(20).fill(still.subarray(19, -1)), Buffer.from([0x3b])]) }));
  await page.addInitScript(({ permission }) => {
    const testState = { permissions: 0, events: [] as { name: string; data: unknown }[], complete: () => {}, disconnect: () => {} };
    Object.assign(window, { testState, umami: { identify() {}, track(name: string, data: unknown) { testState.events.push({ name, data }); } } });
    class FakeEventSource {
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        testState.complete = () => this.onmessage?.({ data: JSON.stringify({ status: "COMPLETED", result_url: "/examples/hippo-pets/dog-result-still.png", result_asset_id: "result-v2" }) });
        testState.disconnect = () => this.onerror?.();
      }
      close() {}
    }
    Object.defineProperty(window, "EventSource", { value: FakeEventSource });
    Object.defineProperty(window, "Notification", { value: { requestPermission: async () => { testState.permissions += 1; return permission; } } });
    Object.defineProperty(window, "PushManager", { value: class {}, configurable: true });
    const registration = { pushManager: { getSubscription: async () => null, subscribe: async () => ({ toJSON: () => ({ endpoint: "https://fcm.googleapis.com/test", keys: { p256dh: "mock", auth: "mock" } }) }) } };
    Object.defineProperty(navigator, "serviceWorker", { value: { register: async () => registration, ready: Promise.resolve(registration) } });
  }, { permission });
  return state;
}

async function compose(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "나도 만들어볼래요!", exact: true }).click();
  await page.getByRole("button", { name: "물 맞는 하마 선택", exact: true }).click();
  await page.getByRole("group", { name: "선택한 GIF", exact: true }).getByRole("button", { name: "사진 고르기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await expect(page.getByAltText("my photo")).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles("public/examples/hippo-pets/dog.jpg");
  await expect(page.getByAltText("my photo")).toBeVisible();
}

test("category topics retain provider order while the selection bar changes and clears the tentative GIF", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await page.getByRole("button", { name: "나도 만들어볼래요!", exact: true }).click();
  await page.getByRole("navigation", { name: "GIF 분류" }).getByRole("button", { name: "동작", exact: true }).click();
  await page.getByRole("button", { name: "춤추기 GIF 둘러보기", exact: true }).click();
  const choices = page.getByTestId("gif-results").locator(".gif-choice");
  await expect(choices).toHaveCount(2);
  await expect(choices.first()).toHaveAttribute("aria-label", "물 맞는 하마 선택");
  await expect(choices.nth(1)).toHaveAttribute("aria-label", "두 번째 GIF 선택");
  const selection = page.getByRole("group", { name: "선택한 GIF", exact: true });
  await expect(selection).toHaveCount(0);
  await choices.first().click();
  await expect(choices.first()).toHaveAttribute("aria-pressed", "true");
  await expect(selection).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(selection.getByRole("status")).toHaveText("물 맞는 하마 선택됨");
  await choices.nth(1).click();
  await expect(choices.first()).toHaveAttribute("aria-pressed", "false");
  await expect(choices.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(selection.getByRole("status")).toHaveText("두 번째 GIF 선택됨");
  const expand = selection.getByRole("button", { name: "선택한 GIF 크게 보기", exact: true });
  await expand.click();
  const preview = page.getByRole("dialog", { name: "대상을 바꿔볼까요?", exact: true });
  await expect(preview).toBeVisible();
  await expect(preview).not.toContainText("프레임");
  await expect(preview.getByRole("button", { name: "사진 고르기", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem("compose_gif"))).toBeNull();
  await preview.getByRole("button", { name: "GIF 미리보기 닫기", exact: true }).click();
  await expect(expand).toBeFocused();
  await expect(choices.nth(1)).toHaveAttribute("aria-pressed", "true");
  await selection.getByRole("button", { name: "GIF 선택 취소", exact: true }).click();
  await expect(selection).toHaveCount(0);
  await expect(choices.nth(1)).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/\/\?browse=1$/);
});

for (const control of ["selection_bar", "preview"] as const) test(`mobile ${control} opens compose without a file picker and keeps photo selection in compose`, async ({ page }) => {
  const state = await setup(page);
  let filePickerOpened = false;
  page.on("filechooser", () => { filePickerOpened = true; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "나도 만들어볼래요!", exact: true }).click();
  const choice = page.getByRole("button", { name: "물 맞는 하마 선택", exact: true });
  await choice.click();
  const selection = page.getByRole("group", { name: "선택한 GIF", exact: true });
  const expand = selection.getByRole("button", { name: "선택한 GIF 크게 보기", exact: true });
  const preview = page.getByRole("dialog", { name: "대상을 바꿔볼까요?", exact: true });
  await expect(preview).toHaveCount(0);
  await expand.click();
  await expect(preview).toBeVisible();
  await expect(preview).not.toContainText("프레임");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(expand).toBeFocused();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  if (control === "preview") await expand.click();
  await (control === "preview" ? preview : selection).getByRole("button", { name: "사진 고르기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await expect(page.getByAltText("my photo")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "사진 고르기", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "만들기", exact: true })).toHaveCount(0);
  expect(filePickerOpened).toBe(false);
  await page.locator('input[type="file"]').setInputFiles("public/examples/hippo-pets/dog.jpg");
  await expect(page.getByAltText("my photo")).toBeVisible();
  expect(state.requests).toBe(0);
  await expect(page.getByRole("heading", { name: "넣은 사진", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "사진 삭제", exact: true }).click();
  await expect(page.getByAltText("my photo")).toHaveCount(0);
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await expect(page.getByRole("button", { name: "사진 고르기", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "만들기", exact: true })).toHaveCount(0);
});

test("request acceptance gates safe departure and notification registration is explicit", async ({ page }) => {
  const state = await setup(page);
  await compose(page);
  state.accept = false;
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByText("접수가 끝날 때까지 이 화면을 유지해주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "완료되면 알림 받기" })).toHaveCount(0);
  state.accept = true;
  await expect(page.getByRole("heading", { name: "GIF를 만들고 있어요" })).toBeVisible();
  await expect(page.locator("header")).toContainText("비회원 · 사용 가능 1회");
  expect(await page.evaluate(() => (window as unknown as { testState: { permissions: number } }).testState.permissions)).toBe(0);
  await page.getByRole("button", { name: "완료되면 알림 받기" }).click();
  await expect(page.getByRole("button", { name: "알림을 받을게요" })).toBeDisabled();
  expect(state.subscriptions).toBe(1);
  await page.evaluate(() => (window as unknown as { testState: { complete: () => void } }).testState.complete());
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "GIF 저장" })).toBeEnabled();
  await page.getByRole("button", { name: "다시 만들기" }).click();
  await expect(page.getByAltText("my photo")).toBeVisible();
});

for (const mode of ["denied", "server_failure"] as const) test(`notification ${mode} does not claim subscription or block completion`, async ({ page }) => {
  const state = await setup(page, mode === "denied" ? "denied" : "granted", mode === "server_failure");
  await compose(page);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await page.getByRole("button", { name: "완료되면 알림 받기" }).click();
  await expect(page.getByText(mode === "denied" ? /알림이 차단되어/ : /알림 신청을 완료하지 못했어요/)).toBeVisible();
  await expect(page.getByRole("button", { name: "알림을 받을게요" })).toHaveCount(0);
  expect(state.subscriptions).toBe(mode === "denied" ? 0 : 1);
  await page.evaluate(() => (window as unknown as { testState: { complete: () => void } }).testState.complete());
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
});

test("notification return opens the exact private result beyond the list", async ({ page }) => {
  await setup(page);
  await page.goto("/my-assets?job=job-v2&from=notification");
  await expect(page.getByRole("region", { name: "알림으로 돌아온 결과" }).getByAltText("합성 결과")).toBeVisible();
});

for (const width of [320, 390, 768, 1440]) test(`capture actual first experience at ${width}px`, async ({ page }, testInfo) => {
  const captureDir = path.join("qa/first-experience", testInfo.project.name === "chromium" ? "" : testInfo.project.name);
  await page.setViewportSize({ width, height: width < 700 ? 844 : 1000 });
  await setup(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "나도 만들어볼래요!", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "어떻게 만드나요?", exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(captureDir, `home-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole("button", { name: "나도 만들어볼래요!", exact: true }).click();
  await expect(page.getByText("넣고 싶은 대상을 떠올리며 둘러보세요.", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(captureDir, `browse-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole("button", { name: "물 맞는 하마 선택", exact: true }).click();
  const selection = page.getByRole("group", { name: "선택한 GIF", exact: true });
  await expect(selection).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({ path: path.join(captureDir, `selection-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await selection.getByRole("button", { name: "사진 고르기", exact: true }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByRole("heading", { name: "사진을 넣어보세요" })).toBeVisible();
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await expect(page.getByAltText("my photo")).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles("public/examples/hippo-pets/dog.jpg");
  await expect(page.getByAltText("my photo")).toBeVisible();
  await page.screenshot({ path: path.join(captureDir, `input-${width}.png`) });
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "GIF를 만들고 있어요" })).toBeVisible();
  await page.screenshot({ path: path.join(captureDir, `waiting-${width}.png`) });
  await page.evaluate(() => (window as unknown as { testState: { complete: () => void } }).testState.complete());
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
  await expect(page.getByAltText("합성 결과")).toBeVisible();
  await page.screenshot({ path: path.join(captureDir, `result-${width}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(errors).toEqual([]);
});

test("composition does not depend on a separate frame inspection", async ({ page }) => {
  await setup(page);
  await page.context().route("**/frame.gif", route => route.abort());
  await compose(page);
  await expect(page.locator("main")).not.toContainText("프레임");
  await expect(page.getByRole("button", { name: "만들기", exact: true })).toBeEnabled();
});

test("unsupported notification is explained without permission prompt or subscription", async ({ page }) => {
  const state = await setup(page);
  await page.addInitScript(() => { Reflect.deleteProperty(window, "PushManager"); });
  await compose(page);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("button", { name: "알림 사용 불가" })).toBeDisabled();
  await expect(page.getByText(/이 기기·브라우저에서는 알림을 지원하지 않아요/)).toBeVisible();
  expect(state.subscriptions).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { testState: { permissions: number } }).testState.permissions)).toBe(0);
});

test("status disconnection is not reported as synthesis failure and can recover", async ({ page }) => {
  await setup(page);
  await page.route("http://localhost:8000/compositions/job-v2", route => route.fulfill({ json: { status: "PROCESSING", stage: null } }));
  await compose(page);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "GIF를 만들고 있어요" })).toBeVisible();
  await page.evaluate(() => (window as unknown as { testState: { disconnect: () => void } }).testState.disconnect());
  await expect(page.getByText(/진행 상태를 다시 연결하고 있어요/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "작업에 실패했습니다" })).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { testState: { complete: () => void } }).testState.complete());
  await expect(page.getByRole("heading", { name: "완성됐어요!" })).toBeVisible();
});

test("disabled server notification is visible before clicking and never requests permission", async ({ page }) => {
  const state = await setup(page);
  await page.route("http://localhost:8000/web-push/config", route => route.fulfill({ json: { enabled: false, public_key: null } }));
  await compose(page);
  await page.getByRole("button", { name: "만들기", exact: true }).click();
  await expect(page.getByRole("button", { name: "알림 사용 불가" })).toBeDisabled();
  await expect(page.getByText(/완료 알림을 아직 사용할 수 없어요/)).toBeVisible();
  expect(state.subscriptions).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { testState: { permissions: number } }).testState.permissions)).toBe(0);
});
