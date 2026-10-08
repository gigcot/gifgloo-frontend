import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve("test-results/anonymous-ui-review");
const ORIGIN = "http://127.0.0.1:3100";
const API = "http://localhost:8000";
const gif = {
  id: "review-gif", slug: "review-gif", title: "검토용 예시 GIF", blur_preview: "",
  file: {
    hd: { gif: { url: "/insung_hwang.gif", width: 1024, height: 1024, size: 1 } },
    md: { gif: { url: "/insung_hwang.gif", width: 1024, height: 1024, size: 1 } },
    sm: {}, xs: {},
  },
};

type Mode = "normal" | "blocked" | "offline" | "preparing" | "empty" | "empty-survey" | "failed" | "member" | "consent-error";
type Shot = { id: string; title: string; note: string; device: string; viewport: string; full: string; text: string };

async function setup(page: Page, mode: Mode = "normal") {
  const state = {
    ready: mode === "member" || mode.startsWith("empty"), consentRequired: !mode.startsWith("empty") && mode !== "member",
    sessionCalls: 0, jobs: 0, submitted: false,
  };
  let finishJob!: () => void;
  const jobGate = new Promise<void>((resolve) => { finishJob = resolve; });
  let finishSession!: () => void;
  const sessionGate = new Promise<void>((resolve) => { finishSession = resolve; });
  const unexpected: string[] = [];

  // All API responses and media are local fixtures. No synthesis, OAuth, or analytics service is contacted.
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === ORIGIN) {
      if (url.pathname === "/api/gif") return route.fulfill({ json: { result: true, data: { data: [gif], current_page: 1, per_page: 12, has_next: false } } });
      if (url.pathname.startsWith("/api/")) {
        unexpected.push(`${request.method()} ${url.pathname}`);
        return route.abort();
      }
      return route.continue();
    }
    if (url.origin !== API) return route.abort();
    const pathname = url.pathname;
    const user = () => ({ user_id: "review-user", user_kind: mode === "member" ? "member" : "anonymous", consent_required: state.consentRequired });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    if (pathname === "/users/me") return route.fulfill(mode === "offline" ? { status: 503, json: {} } : state.ready ? { json: user() } : { status: 401, json: {} });
    if (pathname === "/users/anonymous-session") {
      state.sessionCalls += 1;
      if (mode === "preparing") await sessionGate;
      if (mode === "blocked" || state.sessionCalls === 1) return route.fulfill({ status: 202, json: { ready: false } });
      state.ready = true;
      return route.fulfill({ json: { ...user(), ready: true, created: true } });
    }
    if (pathname === "/users/me/consents") {
      if (mode === "consent-error") return route.fulfill({ status: 503, json: {} });
      state.consentRequired = false;
      return route.fulfill({ json: {} });
    }
    if (pathname === "/credits/balance") {
      const uses = mode.startsWith("empty") ? 0 : 2 - (mode === "failed" ? 0 : state.jobs) + Number(state.submitted);
      return route.fulfill({ json: { balance: uses * 10, remaining_uses: uses, nearest_expires_at: "2026-10-13T00:00:00Z" } });
    }
    if (pathname === "/experiments/exp-001/survey") {
      if (request.method() === "POST") state.submitted = true;
      return route.fulfill({ json: { eligible: mode === "empty-survey" || state.jobs > 0 && mode !== "failed", submitted: state.submitted } });
    }
    if (pathname === "/compositions/uploads") return route.fulfill({ json: { upload_id: "review-upload", upload_url: `${API}/mock-upload`, headers: { "Content-Type": "image/png" } } });
    if (pathname === "/mock-upload") return route.fulfill({ status: 200 });
    if (pathname === "/compositions/from-upload") {
      if (mode.startsWith("empty")) return route.fulfill({ status: 402, json: {} });
      state.jobs += 1;
      return route.fulfill({ json: { composition_job_id: "review-job" } });
    }
    if (pathname === "/compositions/review-job/status") {
      await jobGate;
      const failed = mode === "failed";
      return route.fulfill({ contentType: "text/event-stream", body: `data: ${JSON.stringify({ status: failed ? "FAILED" : "COMPLETED", stage: null, result_url: failed ? null : "/punch_pepe_podo.gif", result_asset_id: failed ? null : "review-asset", failed_reason: null, credit_settlement: { balance_before: 20, charged: 10, refunded: failed ? 10 : 0, balance_after: failed ? 20 : 10 } })}\n\n` });
    }
    if (pathname === "/assets/review-asset/share") return route.fulfill({ json: { share_token: "review-only-not-public" } });
    if (pathname === "/assets/review-asset/download") return route.fulfill({ contentType: "image/gif", headers: { "Content-Disposition": 'attachment; filename="review-result.gif"' }, path: "public/punch_pepe_podo.gif" });
    if (pathname === "/compositions/review-job/feedback") return route.fulfill({ json: {} });
    if (pathname === "/compositions") return route.fulfill({ json: { jobs: state.jobs ? [{ job_id: "review-job", status: "COMPLETED", source_gif_url: "/insung_hwang.gif", target_url: "/icon.png", result_url: "/punch_pepe_podo.gif", result_asset_id: "review-asset", created_at: "2026-10-06T00:00:00Z" }] : [] } });
    unexpected.push(`${request.method()} ${pathname}`);
    return route.fulfill({ status: 500, json: { message: "Unconfigured capture fixture" } });
  });
  return { finishJob, finishSession, unexpected };
}

async function capture(page: Page, info: TestInfo, id: string, title: string, note: string, modal = false) {
  const dir = path.join(ROOT, info.project.name);
  mkdirSync(dir, { recursive: true });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const video of document.querySelectorAll("video")) video.pause();
  });
  if (!modal) await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0);
  const viewport = `${info.project.name}/${id}.png`;
  const full = `${info.project.name}/${id}-full.png`;
  await page.screenshot({ path: path.join(ROOT, viewport), animations: "disabled" });
  if (!modal) await page.screenshot({ path: path.join(ROOT, full), fullPage: true, animations: "disabled" });
  const shot: Shot = { id, title, note, device: info.project.name, viewport, full: modal ? viewport : full, text: await page.locator("body").innerText() };
  writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(shot, null, 2));
  await info.attach(`${id} ${title}`, { path: path.join(ROOT, viewport), contentType: "image/png" });
}

async function inputs(page: Page) {
  await page.addInitScript((selected) => localStorage.setItem("compose_gif", JSON.stringify(selected)), gif);
  await page.goto("/compose");
  await expect(page.getByAltText("selected gif")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles("public/icon.png");
  for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
}

async function submit(page: Page) {
  await expect(page.getByRole("button", { name: "합성하기", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "합성하기", exact: true }).click();
  await page.getByRole("button", { name: "시작하기", exact: true }).click();
}

test("first experience, result, retry, account linking, history and survey", async ({ page }, info) => {
  const mock = await setup(page);
  try {
    await page.goto("/?utm_source=youtube&utm_campaign=exp001_run01");
    await expect(page.getByRole("button", { name: "로그인", exact: true })).toBeVisible();
    await expect(page.getByText(gif.title, { exact: true }).first()).toBeAttached();
    await capture(page, info, "01-home", "홈 · 최초 방문", "기존 화면/문구. 로그인 없이 합성으로 진입하는 연결 흐름 확인.");
    if (info.project.name === "mobile") await page.getByRole("button", { name: "나도 만들기", exact: true }).first().click();
    else await page.getByText(gif.title, { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole("button", { name: "네, 만들기" })).toBeVisible();
    await capture(page, info, "02-gif-confirm", "홈 · GIF 선택 확인", "기존 확인창. 이번 변경의 앞 구간으로 참고.", true);
    await page.getByRole("button", { name: "네, 만들기" }).click();
    await expect(page.getByText("처음 이용하기 전 확인")).toBeVisible();
    await capture(page, info, "03-compose-empty", "합성 · 사진 선택 전", "변경: 사용법, 무료 2회/7일, 쿠키와 내 결과 안내, 사진 라벨, 최초 동의, 익명 헤더.");
    await page.locator('input[type="file"]').setInputFiles("public/icon.png");
    await expect(page.getByAltText("my photo")).toBeVisible();
    await capture(page, info, "04-photo-selected", "합성 · 사진 선택 후 / 동의 전", "사진은 검토용 로고. 동의 미체크일 때 버튼 비활성 상태.");
    for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
    await capture(page, info, "05-ready", "합성 · 입력과 동의 완료", "합성하기 활성 상태. 실제 이용권 차감 전.");
    await page.getByRole("button", { name: "합성하기", exact: true }).click();
    await capture(page, info, "06-usage-confirm", "합성 · 이용권 사용 확인창", "변경: 익명용 무료 이용권/실패 복구/가입 불필요 안내. 확인창 자체는 현재 남아 있음.", true);
    await page.getByRole("button", { name: "시작하기", exact: true }).click();
    await expect(page.getByText("이 화면을 떠나도 내 결과에서 확인할 수 있어요")).toBeVisible();
    await capture(page, info, "07-processing", "합성 · 처리 중", "변경: 내 결과 이동 안내. 서버 완료 응답만 보류해 대기 상태 재현.");
    mock.finishJob();
    await expect(page.getByAltText("합성 결과")).toBeVisible();
    await expect(page.locator("header").getByText("남은 이용권 1회")).toBeVisible();
    await capture(page, info, "08-result", "합성 · 결과 확인", "기존 저장/공유 문구. 변경: 가입·평가 없이 저장/링크 복사/재시도 허용. 결과는 기존 예시 GIF.");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "다운로드", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("review-result.gif");
    await page.getByRole("button", { name: "링크 복사", exact: true }).click();
    await expect(page.getByRole("button", { name: "링크 복사됨", exact: true })).toBeVisible();
    await capture(page, info, "09-link-copied", "결과 · 링크 복사 피드백", "기존 문구. 가짜 공유 링크를 복사하며 외부 게시하지 않음.", true);
    await page.getByRole("button", { name: "다시 만들기", exact: true }).click();
    await expect(page.getByAltText("my photo")).toBeVisible();
    await expect(page.getByText("방금 만든 GIF를 어떻게 사용했는지 알려주세요")).toBeVisible();
    await capture(page, info, "10-retry", "다시 만들기 · 입력 유지 / 설문 안내", "변경: 사진과 GIF 유지, 익명 설문 허용. 설문 안내 문구는 기존 내용.");
    await page.locator("header").getByRole("button", { name: "계정 연결" }).click();
    await expect(page.getByRole("dialog").getByText(/기존 계정으로 로그인하면/)).toBeVisible();
    await capture(page, info, "11-account-link", "계정 연결 · 안내와 동의", "변경: 신규 가입은 연결, 기존 계정은 전환/미병합, 추가 지급 없음. 실제 OAuth는 실행하지 않음.", true);
    await page.getByRole("dialog").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await capture(page, info, "12-account-link-bottom", "계정 연결 · 아래쪽 버튼", "모달 내부를 끝까지 스크롤한 화면. 모바일 소셜 로그인 버튼/안내 확인.", true);
    await page.keyboard.press("Escape");
    await page.locator("header").getByRole("link", { name: "내 결과", exact: true }).click();
    await expect(page.getByAltText("합성 결과")).toBeVisible();
    await capture(page, info, "13-history", "내 결과 · 목록", "기존 목록 UI. 변경: 익명 세션으로 자신의 결과 목록 접근 가능.");
    await page.getByAltText("합성 결과").click();
    await expect(page.getByRole("button", { name: "다운로드", exact: true })).toBeVisible();
    await capture(page, info, "14-history-detail", "내 결과 · 상세", "기존 상세 UI. 익명 저장/공유 동선 확인.", true);
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await page.locator("header").getByRole("button", { name: "이용권 받기", exact: true }).click();
    await expect(page.getByRole("button", { name: "설문 시작", exact: true })).toBeVisible();
    await capture(page, info, "15-survey-intro", "설문 · 시작 안내", "기존 설문 문구. 익명 사용자도 참여 가능해진 연결 구간.", true);
    await page.getByRole("button", { name: "설문 시작", exact: true }).click();
    await capture(page, info, "16-survey-form", "설문 · 질문 상단", "기존 질문/선택지. 모바일 내부 스크롤 확인.", true);
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("그냥 궁금해서", { exact: true }).check();
    await dialog.getByLabel("단체 채팅방에 보냈다", { exact: true }).check();
    await dialog.getByRole("button", { name: "제출하고 이용권 1회 받기" }).scrollIntoViewIfNeeded();
    await capture(page, info, "17-survey-bottom", "설문 · 질문 하단 / 제출", "테스트 답변을 선택한 상태. 실제 설문 데이터는 저장하지 않음.", true);
    await dialog.getByRole("button", { name: "제출하고 이용권 1회 받기" }).click();
    await expect(dialog.getByText("이용권 1회가 지급됐어요")).toBeVisible();
    await capture(page, info, "18-survey-success", "설문 · 보상 완료", "기존 문구. 익명 설문 보상 완료 상태를 가짜 응답으로 재현.", true);
    expect(mock.unexpected).toEqual([]);
  } finally {
    mock.finishJob();
    mock.finishSession();
  }
});

for (const mode of ["blocked", "offline", "preparing"] as const) {
  test(`session ${mode}`, async ({ page }, info) => {
    const mock = await setup(page, mode);
    try {
      await inputs(page);
      if (mode === "preparing") await expect(page.getByText("체험을 준비하고 있어요. 먼저 사진을 골라도 좋아요.")).toBeVisible();
      else await expect(page.locator("main").getByRole("alert")).toBeVisible();
      await capture(page, info, `19-session-${mode}`, `접속 상태 · ${mode === "blocked" ? "쿠키 차단" : mode === "offline" ? "확인 실패" : "체험 준비 중"}`, "변경: 접속 상태 안내/재확인. 선택한 GIF와 사진은 유지.");
      expect(mock.unexpected).toEqual([]);
    } finally { mock.finishSession(); }
  });
}

for (const mode of ["empty", "empty-survey", "consent-error", "failed"] as const) {
  test(`composition ${mode}`, async ({ page }, info) => {
    const mock = await setup(page, mode);
    mock.finishJob();
    await inputs(page);
    await expect(page.locator("header").getByRole("button", { name: "계정 연결" })).toBeVisible();
    // Session preparation can finish after the image picker; wait for the consent controls before submitting.
    if (mode === "consent-error" || mode === "failed") {
      await expect(page.getByRole("checkbox")).toHaveCount(3);
      for (const checkbox of await page.getByRole("checkbox").all()) await checkbox.check();
    }
    await submit(page);
    if (mode.startsWith("empty")) await expect(page.getByText("사용 가능한 이용권이 없어요")).toBeVisible();
    else if (mode === "consent-error") await expect(page.getByText("이용 동의를 저장하지 못했어요. 다시 시도해 주세요.")).toBeVisible();
    else await expect(page.getByText("사용한 이용권 1회가 복구되었습니다.")).toBeVisible();
    await capture(page, info, `20-${mode}`, mode === "empty" ? "이용권 소진 · 설문 대상 아님" : mode === "empty-survey" ? "이용권 소진 · 설문 참여 가능" : mode === "consent-error" ? "동의 저장 실패 · 입력 유지" : "합성 실패 · 이용권 복구", mode.startsWith("empty") ? "변경: 구매/가입 강요 대신 기존 결과 사용 안내. 설문 대상인 경우만 버튼 노출." : "오류 응답을 재현한 화면. 실제 데이터/이용권 변화 없음.", mode.startsWith("empty"));
    expect(mock.unexpected).toEqual([]);
  });
}

test("welcome after first signup", async ({ page }, info) => {
  const mock = await setup(page, "member");
  await page.goto("/callback?is_new_user=true");
  await expect(page.getByText("환영해요!", { exact: true })).toBeVisible();
  await capture(page, info, "21-welcome", "처음 가입 완료 · 환영 안내", "변경: 결과/이용 내역 연결, 처음 이용할 때 2회 지급, 기존 남은 횟수 유지. 실제 가입 없음.", true);
  expect(mock.unexpected).toEqual([]);
});

test.afterAll(() => {
  mkdirSync(ROOT, { recursive: true });
  const shots = readdirSync(ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((entry) =>
    readdirSync(path.join(ROOT, entry.name)).filter((name) => name.endsWith(".json")).map((name) => JSON.parse(readFileSync(path.join(ROOT, entry.name, name), "utf8")) as Shot));
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  const ids = [...new Set(shots.map((shot) => shot.id))].sort();
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gifgloo 익명 체험 화면 검토</title><style>body{margin:0;background:#f3f3f5;color:#20202a;font:16px/1.65 system-ui}main{max-width:1500px;margin:auto;padding:28px}section{background:white;padding:24px;margin:24px 0;border-radius:16px}h1,h2{line-height:1.4}nav{display:flex;flex-wrap:wrap;gap:8px}a{color:#603cc4}.grid{display:grid;grid-template-columns:minmax(260px,390px) minmax(0,1fr);gap:24px;align-items:start}img{width:100%;display:block;border:1px solid #ccc}details{margin-top:12px}pre{white-space:pre-wrap;font:14px/1.6 system-ui}small{color:#666}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><main><h1>Gifgloo 익명 체험 화면 검토</h1><p>현재 제품 코드를 Chromium에서 자동 촬영. 모바일 390×844 / 데스크톱 1440×1000. 모바일은 화면·터치 에뮬레이션이며 실제 Safari/안드로이드 검증이 아닙니다.</p><p><strong>모든 API는 가짜 응답. 운영 DB·OAuth·합성·결제·분석 서비스 호출 없음.</strong> GIF는 저장소의 기존 예시, 입력 사진은 로고입니다. 실제 합성 결과가 아닙니다. CSS 애니메이션은 캡처 시 비활성화하며 GIF 프레임은 촬영 순간에 따라 다릅니다.</p><p>각 이미지는 현재 보이는 화면입니다. 긴 페이지는 ‘전체 페이지’로 확인하세요. 모달은 별도의 아래쪽 캡처를 확인하세요. 문구 수정 의견은 화면 번호와 함께 남기면 됩니다.</p><nav>${ids.map((id) => `<a href="#${id}">${escape(id)}</a>`).join(" · ")}</nav>${ids.map((id) => {
    const group = shots.filter((shot) => shot.id === id).sort((a, b) => b.device.localeCompare(a.device));
    return `<section id="${id}"><h2>${escape(id)} · ${escape(group[0].title)}</h2><p>${escape(group[0].note)}</p><div class="grid">${group.map((shot) => `<div><h3>${shot.device === "mobile" ? "모바일 · 390×844" : "데스크톱 · 1440×1000"}</h3><a href="${shot.viewport}"><img src="${shot.viewport}" loading="lazy" alt="${escape(shot.title)}"></a><a href="${shot.full}">전체 페이지 / 원본 PNG</a><details><summary>화면 텍스트</summary><pre>${escape(shot.text)}</pre></details></div>`).join("")}</div></section>`;
  }).join("")}<small>캡처 ${shots.length}개 상태·화면 조합 · 생성 ${new Date().toISOString()}</small></main></html>`;
  writeFileSync(path.join(ROOT, "index.html"), html);
  writeFileSync(path.join(ROOT, "manifest.json"), JSON.stringify(shots, null, 2));
});
