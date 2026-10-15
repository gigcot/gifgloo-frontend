import { expect, test, type Locator, type Page } from "@playwright/test";

async function setup(page: Page) {
  const requests: string[] = [];
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("https://cloud.umami.is/**", route => route.abort());
  await page.route("https://static.klipy.com/**", route => route.fulfill({ contentType: "image/png", path: "public/icon.png" }));
  await page.route("http://localhost:8000/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/users/me") return route.fulfill({ json: { user_id: "stage-user", user_kind: "anonymous", consent_required: false } });
    if (pathname === "/credits/balance") return route.fulfill({ json: { balance: 20, remaining_uses: 2, nearest_expires_at: null } });
    if (pathname === "/experiments/exp-001/survey") return route.fulfill({ json: { eligible: false, submitted: false } });
    return route.fulfill({ status: 500, json: { message: "Unexpected mocked endpoint" } });
  });
  await page.route("**/api/gif?**", route => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") ?? 1);
    const query = url.searchParams.get("q") ?? "";
    requests.push(`${query}:${pageNumber}`);
    const format = { url: "/icon.png", width: 320, height: 320, size: 1024 };
    return route.fulfill({ json: { result: true, data: {
      data: Array.from({ length: 24 }, (_, index) => ({
        id: `${query}-${pageNumber}-${index}`, slug: `scene-${query}-${pageNumber}-${index}`, title: `${query || "Scene"} ${pageNumber}-${index}`, blur_preview: "",
        file: { hd: { gif: format }, md: { gif: format }, sm: { gif: format }, xs: {} },
      })), current_page: pageNumber, has_next: pageNumber < 3,
    } } });
  });
  return requests;
}

async function wheelBurst(page: Page, target: Locator, deltaY: number) {
  await target.hover();
  for (let index = 0; index < 3; index++) await page.mouse.wheel(0, deltaY);
}

async function swipe(page: Page, target: Locator, fromY: number, toY: number) {
  const touch = (clientY: number) => ({ identifier: 1, clientX: 190, clientY });
  await target.dispatchEvent("touchstart", { touches: [touch(fromY)], changedTouches: [touch(fromY)] });
  await target.dispatchEvent("touchmove", { touches: [touch(toY)], changedTouches: [touch(toY)] });
  await page.locator("[data-home-stage]").dispatchEvent("touchend", { touches: [], changedTouches: [touch(toY)] });
}

test("upward boundary scrolling offers a return button and waits for confirmation", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const stage = page.locator("[data-home-stage]");
  const returnButton = page.getByRole("button", { name: "첫 화면으로 돌아가기", exact: true });
  await expect(stage).toHaveAttribute("data-home-stage", "examples");
  const examples = stage.locator("[data-contained-scroll]");
  await examples.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await examples.hover();
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(350);
  await expect(stage).toHaveAttribute("data-home-stage", "examples");
  await wheelBurst(page, examples, 120);
  await expect(stage).toHaveAttribute("data-home-stage", "browse");
  await expect(page.getByRole("button", { name: "Scene 1-0 선택", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(800);
  const results = page.locator("[data-gif-scroll-container]");
  await results.evaluate(element => { element.scrollTop = 0; });
  await results.hover();
  await page.mouse.wheel(0, 300);
  await expect.poll(() => results.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.waitForTimeout(150);
  expect(await results.evaluate(element => element.scrollTop)).toBeLessThan(300);
  await page.mouse.wheel(0, -12);
  await expect(stage).toHaveAttribute("data-home-stage", "browse");
  await expect(returnButton).toBeHidden();
  await results.evaluate(element => { element.scrollTop = 0; });
  await page.waitForTimeout(1200);
  await page.mouse.wheel(0, -40);
  await page.waitForTimeout(350);
  await expect(stage).toHaveAttribute("data-home-stage", "browse");
  await expect(returnButton).toBeHidden();
  await wheelBurst(page, results, -120);
  await expect(returnButton).toBeVisible();
  await expect(stage).toHaveAttribute("data-home-stage", "browse");
  await page.mouse.wheel(0, 300);
  await expect.poll(() => results.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(returnButton).toBeHidden();
  await results.evaluate(element => { element.scrollTop = 0; });
  await wheelBurst(page, results, -120);
  await expect(returnButton).toBeVisible();
  await expect(stage).toHaveAttribute("data-home-stage", "browse");
  await returnButton.click();
  await expect(stage).toHaveAttribute("data-home-stage", "examples");
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("PageUp at the browsing boundary focuses the return button before Enter returns home", async ({ page }) => {
  await setup(page);
  await page.goto("/?browse=1");
  const stage = page.locator("[data-home-stage]");
  const results = page.locator("[data-gif-scroll-container]");
  const returnButton = page.getByRole("button", { name: "첫 화면으로 돌아가기", exact: true });
  await expect(page.getByRole("button", { name: "Scene 1-0 선택", exact: true })).toBeVisible();
  await expect(returnButton).toBeHidden();
  await results.focus();
  await page.keyboard.press("PageUp");
  await expect(returnButton).toBeVisible();
  await expect(returnButton).toBeFocused();
  await expect(stage).toHaveAttribute("data-home-stage", "browse");
  await page.keyboard.press("Enter");
  await expect(stage).toHaveAttribute("data-home-stage", "examples");
});

test("category sidebar scrolling never moves GIF results or switches the stage at its edges", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?browse=1");
  const stage = page.locator("[data-home-stage]");
  const results = page.locator("[data-gif-scroll-container]");
  const sidebar = page.locator("[data-gif-sidebar]");
  await expect(page.getByRole("button", { name: "Scene 1-0 선택", exact: true })).toBeVisible();
  await expect(sidebar).toBeVisible();
  await expect.poll(() => sidebar.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
  await results.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => results.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const resultPosition = await results.evaluate(element => element.scrollTop);
  await sidebar.hover();
  await page.mouse.wheel(0, 500);
  await expect.poll(() => sidebar.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await results.evaluate(element => element.scrollTop)).toBe(resultPosition);
  await sidebar.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await wheelBurst(page, sidebar, 600);
  await expect(stage).toHaveAttribute("data-home-stage", "browse");
  expect(await results.evaluate(element => element.scrollTop)).toBe(resultPosition);
  await sidebar.evaluate(element => { element.scrollTop = 0; });
  await results.evaluate(element => { element.scrollTop = 0; });
  await wheelBurst(page, sidebar, -600);
  await expect(stage).toHaveAttribute("data-home-stage", "browse");
  await expect(page.getByRole("button", { name: "첫 화면으로 돌아가기", exact: true })).toBeHidden();
  expect(await results.evaluate(element => element.scrollTop)).toBe(0);
});

test("collapsing desktop categories preserves the search and current GIF results", async ({ page }) => {
  const requests = await setup(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?browse=1");
  const query = page.getByRole("searchbox", { name: "GIF 검색", exact: true });
  const sidebar = page.locator("[data-gif-sidebar]");
  const choices = page.locator(".gif-choice");
  await expect(choices).toHaveCount(24);
  await query.fill("astronaut");
  await query.press("Enter");
  await expect.poll(() => requests.at(-1)).toBe("astronaut:1");
  await expect(page.getByRole("button", { name: "astronaut 1-0 선택", exact: true })).toBeVisible();
  await expect(choices).toHaveCount(24);
  const titles = await choices.allTextContents();
  const requestCount = requests.length;
  const collapse = page.getByRole("button", { name: "분류 접기", exact: true });
  await expect(sidebar).toBeVisible();
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await collapse.click();
  const expand = page.getByRole("button", { name: "분류 펼치기", exact: true });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(sidebar).toBeHidden();
  await expect(query).toHaveValue("astronaut");
  await expect(choices).toHaveText(titles);
  await expand.click();
  await expect(collapse).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar).toBeVisible();
  await expect(query).toHaveValue("astronaut");
  await expect(choices).toHaveText(titles);
  expect(requests).toHaveLength(requestCount);
});

test("scrolling in GIF preview keeps the dialog and current browsing stage open", async ({ page }) => {
  await setup(page);
  await page.goto("/?browse=1");
  await page.getByRole("button", { name: "Scene 1-0 선택", exact: true }).click();
  await page.getByRole("button", { name: "선택한 GIF 크게 보기", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "대상을 바꿔볼까요?", exact: true });
  await expect(preview).toBeVisible();
  await wheelBurst(page, preview, -600);
  await expect(preview).toBeVisible();
  await expect(page.locator("[data-home-stage]")).toHaveAttribute("data-home-stage", "browse");
  await expect(page.getByRole("button", { name: "첫 화면으로 돌아가기", exact: true })).toBeHidden();
  await expect(preview.getByRole("button", { name: "사진 고르기", exact: true })).toBeEnabled();
});

test.describe("touch stage navigation", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("touch overscroll offers a return button without leaving the GIF list", async ({ page }) => {
    await setup(page);
    await page.goto("/");
    const stage = page.locator("[data-home-stage]");
    const returnButton = page.getByRole("button", { name: "첫 화면으로 돌아가기", exact: true });
    await expect(stage).toHaveAttribute("data-home-stage", "examples");
    await stage.locator("[data-contained-scroll]").evaluate(element => { element.scrollTop = element.scrollHeight; });
    await swipe(page, stage.locator("[data-contained-scroll]"), 560, 540);
    await expect(stage).toHaveAttribute("data-home-stage", "examples");
    await swipe(page, stage.locator("[data-contained-scroll]"), 560, 300);
    await expect(stage).toHaveAttribute("data-home-stage", "browse");
    await expect(page.getByRole("button", { name: "Scene 1-0 선택", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(844);
    const results = page.locator("[data-gif-scroll-container]");
    await results.evaluate(element => { element.scrollTop = 0; });
    await page.waitForTimeout(1200);
    await swipe(page, results, 280, 300);
    await expect(stage).toHaveAttribute("data-home-stage", "browse");
    await expect(returnButton).toBeHidden();
    await swipe(page, results, 280, 540);
    await expect(returnButton).toBeVisible();
    await expect(stage).toHaveAttribute("data-home-stage", "browse");
    await returnButton.tap();
    await expect(stage).toHaveAttribute("data-home-stage", "examples");
  });

  test("mobile categories open as a scrollable left drawer and isolate the background", async ({ page }) => {
    await setup(page);
    await page.goto("/?browse=1");
    const stage = page.locator("[data-home-stage]");
    const results = page.locator("[data-gif-scroll-container]");
    await expect(page.getByRole("button", { name: "Scene 1-0 선택", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "카테고리 선택", exact: true }).tap();
    const drawer = page.getByRole("dialog", { name: "GIF 분류", exact: true });
    const categories = drawer.getByRole("navigation", { name: "모든 GIF 분류", exact: true });
    await expect(drawer).toBeVisible();
    const bounds = await drawer.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeCloseTo(0, 0);
    expect(bounds!.y).toBeCloseTo(0, 0);
    expect(bounds!.width).toBeLessThanOrEqual(390 * .84);
    expect(bounds!.height).toBeCloseTo(844, 0);
    const first = await categories.getByRole("button").nth(0).boundingBox();
    const second = await categories.getByRole("button").nth(1).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.x).toBeCloseTo(first!.x, 0);
    expect(second!.width).toBeCloseTo(first!.width, 0);
    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
    await expect.poll(() => categories.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
    await categories.hover();
    await page.mouse.wheel(0, 500);
    await expect.poll(() => categories.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await results.evaluate(element => element.scrollTop)).toBe(0);
    await categories.evaluate(element => { element.scrollTop = 0; });
    await wheelBurst(page, categories, -600);
    await page.mouse.move(375, 500);
    await page.mouse.wheel(0, 600);
    await swipe(page, results, 280, 540);
    await expect(drawer).toBeVisible();
    await expect(stage).toHaveAttribute("data-home-stage", "browse");
    await expect(page.getByRole("button", { name: "첫 화면으로 돌아가기", exact: true })).toBeHidden();
    expect(await results.evaluate(element => element.scrollTop)).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await categories.getByRole("button", { name: "동작", exact: true }).tap();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("button", { name: "첫 화면으로 돌아가기", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "춤추기 GIF 둘러보기", exact: true })).toBeVisible();
    await expect(stage).toHaveAttribute("data-home-stage", "browse");
  });
});
