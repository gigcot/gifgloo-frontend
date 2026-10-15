# 2026-10-15 — 통합 배포 준비와 리뷰 수정

사용자가 프론트·백엔드·Lambda 변경의 커밋·PR·머지·운영 배포를 승인했다. 프론트는 이 작업에서, 백엔드와 AI/GIF Lambda는 별도 세션의 PR #20에서 담당한다. API 계약·DB 스키마 변경은 없다.

- 결과 미리보기의 프레임 지연을 이전 마감 시각 기준으로 누적하도록 수정했다. 늦은 화면 갱신은 해당 시점의 프레임까지 진행하며 긴 백그라운드 정지에서는 전체 주기를 건너뛴다.
- MP4 변환 실패 후 같은 형식을 다시 골라도 오류·재시도 버튼을 유지한다. 명시적 재시도는 실제 변환을 다시 시작한다.
- 실제 컴포넌트 effect·클릭 핸들러를 실행하는 오프라인 회귀 3개를 추가했다. 독립 리뷰어가 60Hz 재생과 불규칙한 시각 10,000회, MP4 실패 후 재시작을 재확인했다. 2.52초 GIF는 60Hz에서 2.533초 이내에 순환한다.
- 사용자에게 원본 GIF·입력 사진·합성 MP4·포스터 총 12개 파일의 GitHub 및 운영 사이트 공개 범위를 확인했고 명시 승인받았다. `public/examples/onboarding/`에 3개 예시를 포함하고 로컬 전용 분기를 제거했다. 기존 비공개 작업 폴더는 계속 Git 제외 상태다. 임시 공개 결정과 원본 콘텐츠 사용권 확인 완료를 구분한다.

이번 코드에서 단위 테스트 28개, TypeScript (`--noEmit --incremental false`), 전체 ESLint, Webpack 운영 빌드, `git diff --check`가 통과했다. 로컬 기본 Turbopack 빌드는 PostCSS 처리 중 내부 포트 생성이 환경에서 금지되어 실패했다. GitHub CI의 기본 빌드·전체 E2E와 운영 배포 결과는 PR/Actions에서 확인한다. 실제 유료 합성·외부 메시징 앱 전달 검증은 이번 준비 단계에서 실행하지 않았다.

GitHub PR #18 첫 CI(run 38700676104)에서 기본 Turbopack 빌드·ESLint·단위 테스트 28개가 통과했다. E2E는 81개 통과·1개 건너뜀·1개 실패였으며, 실패는 직접 `/compose` 진입 시 사진 선택 전에도 동의 문구가 보인다고 가정한 이전 테스트였다. 준비 상태를 현재 화면의 ‘사진 고르기’ 버튼으로 확인하고, 원래 목적이던 `compose_viewed.flow_origin=direct_compose`를 이벤트 도착까지 기다려 검증하도록 수정했다. 제품 동작은 변경하지 않았으며 수정 후 전체 CI 결과는 PR에서 확인한다. 건너뛴 항목은 별도 설정이 필요한 운영 Umami 수집 테스트다.

아래 기록은 각 이전 작업 시점의 상태이며 위 배포 준비와 구분한다.

---

# 2026-10-15 — 결과 화면 실제 프론트 연결

## 범위와 현재 상태

사용자가 맡긴 1번 작업: 승인한 결과 UI·브라우저 내보내기를 실제 프론트의 합성 직후 / 내 결과 모달 / 알림 결과에 연결했다. 공유받는 사람의 공개 결과 화면은 기존 구성을 유지한다. 아래 검증은 이번 코드에 대한 기록이며 이전 QA의 통과를 재사용하지 않았다.

- `ResultMedia.tsx`와 CSS Module로 아이콘 툴바, 재생·정지, GIF/MP4 선택, 장면 목록, PNG 복사·저장을 연결.
- 파일은 기존 `GET /assets/{id}/content`에 `authFetch`, credentials, no-store, redirect:error로 요청한다. 직접 외부 이미지 URL을 가져와 변환하지 않는다. 사용자·에셋 변경 시 컴포넌트를 교체하고 요청·변환을 취소하며 bitmap/blob URL을 해제한다.
- GIF 저장은 가져온 원본 바이트를 사용한다. 파일 준비 실패 시 기존 권한 검사 다운로드 주소를 사용한다. MP4는 브라우저에서 H264로 만들고, PNG는 선택한 원본 해상도 장면을 쓴다. 미리보기 bitmap은 최대 840px로 제한하지만 내보내기는 원본 크기를 유지한다.
- 64 MiB, 가로/세로 4096px, 120장, 전체 1억 픽셀을 넘는 GIF는 브라우저 장면 추출을 중단하고 GIF 저장을 안내한다. 지원하지 않는 MP4·파일 공유·이미지 복사에는 대체 방법을 안내한다.
- 공개 링크 발급은 기존 `POST /assets/{id}/share`, 만족도는 기존 CompositionFeedback API, 다시 만들기는 기존 handleReset을 유지한다. 공개 링크는 사용자가 링크 복사를 누를 때만 발급한다.
- 백엔드·Lambda·품질 실험·배포 환경·Notion을 수정하지 않았다. 커밋·푸시·배포·신규 유료 합성을 실행하지 않았다. 기존 미커밋 작업을 보존했다.

## 디자인 QA

**Source visual truth**

- 확정된 로컬 구현: `/Users/gigcot/.codex/visualizations/2026/10/14/01a13b53-9faf-7981-a2ab-a167ea7290df/compose-consent-preview/qa/result-frame-mobile-final.png` (390×914, CSS 390×914, 1x)
- 기본/형식 선택: 같은 폴더 `result-default-mobile-final.png` (390×871, CSS 390×871, 1x)
- 선택 디자인 원본: `/Users/gigcot/.codex/generated_images/01a13b53-9faf-7981-a2ab-a167ea7290df/exec-ef2346ae-576d-42d8-b23c-f246a3657103.png`

**Implementation evidence**

경로: `/Users/gigcot/.codex/visualizations/2026/10/14/01a13b53-9faf-7981-a2ab-a167ea7290df/service-result-integration-qa/`

- `result-frame-final-full.png`: CSS viewport 390×914, 전체 페이지 390×1100. 비교는 위 914px만 잘라 같은 좌표·1x로 정렬. 3번째 장면·PNG 모드.
- `comparison-frame-final.png`: 위 소스와 실제 화면을 한 이미지에서 좌우 비교 (780×914).
- `comparison-controls-final.png`: 툴바·장면·만족도 영역 확대 비교 (780×365).
- `comparison-default-final.png`: GIF 선택 메뉴가 열린 상태의 비교 (780×871). 애니메이션 촬영 시점이 달라 GIF 내부 자세는 비교 대상에서 제외하고, 동일 3번째 장면 비교와 PNG 픽셀 검증을 별도로 수행했다.
- `result-desktop-final.png`: CSS viewport 1280×900, 420px 폭의 결과 영역.
- `result-my-assets-frame-320.png`: CSS viewport 320×740, 모달에서 장면 선택.
- `result-mobile-final.png`: 전달용 390×871 결과 화면.

**Findings / iteration**

- 초기 P2: 기존 서비스 만족도 영역이 시안보다 작았고 제목에 프로그램 포커스 테두리가 나타났다. 합성 결과에만 적용되는 CSS로 글자·버튼 크기와 제목 표시를 맞췄다. 수정 후 위 full/focused 비교를 새로 캡처했다.
- 글꼴: 기존 Arial/Apple SD Gothic Neo 계열과 제목 32px, 만족도 제목 18px, 응답 버튼 16px를 유지·정렬했다. 실제 서비스 기본 글꼴에서 응답 버튼 획이 시안보다 조금 가늘게 보이는 점은 P3 후속 조정으로 남긴다.
- 간격: 모바일 이미지 362px, 전체 비율 유지, 아이콘 원형 52px. 320px 모달에서는 최소 44px 버튼과 72px 형식 선택이 가로 넘침 없이 배치됐다.
- 색: #9809ff 주 행동, #c27bff 외곽선·선택 상태, 어두운 배경을 유지했다.
- 이미지: 같은 실제 GIF의 3번째 장면을 사용한다. 잘림 없이 표시하고 PNG 내보내기는 독립 추출 결과와 픽셀 일치했다. 썸네일도 전체 비율을 유지한다.
- 문구: 로컬 예시 안내를 제품 UI에 넣지 않았다. 복사·다운로드 안내는 해당 동작의 범위만 설명한다.
- 의도한 차이: 실제 세션의 ‘내 결과’ 헤더/사용 횟수와 기존 서비스 푸터를 유지한다. 시안의 목업 로그인 버튼·로컬 예시 꼬리말은 가져오지 않았다. 헤더 높이 차이로 본문 시작이 약 4px 위에 위치한다.
- P0/P1/P2 잔여 항목 없음. 표준 아이콘 라이브러리를 사용하며 수작업 SVG나 이미지 대체 도형을 만들지 않았다.

final result: passed

## 이번 검증

- `npm run test:unit` — 25개 통과 (기존 15 + 신규 10). GIF disposal 2/3, 프레임 지연, 취소/자원 해제, 과도한 입력 제한, MP4 타임라인·인코더 미지원·취소, 비동기 공유 링크 클립보드를 포함한다.
- `npx tsc --noEmit --incremental false` — 통과.
- `npm run lint` — 전체 통과. 신규 테스트의 this 별칭 린트 오류를 수정 후 다시 실행했다.
- `NEXT_PUBLIC_API_BASE=http://127.0.0.1:8008 npm run build -- --webpack` — 최종 코드 빌드 통과. `.env.local`은 수정하지 않았고, 이 빌드의 API 주소만 로컬 QA용이다. 배포 빌드는 해당 환경의 원래 API 설정으로 새로 실행해야 한다.
- `git diff --check` — 통과.
- 기존 E2E의 ‘다운로드’ 선택자 3곳은 새 ‘GIF 저장’ 접근성 이름에 맞췄다. Playwright CLI E2E 전체를 이번에 실행하지는 않았다.
- `npm audit`는 기존 ESLint 개발 의존성 체인(braces → micromatch → fast-glob → Next lint)에 high 5개를 보고했다. 새 gifuct-js/lucide-react/mediabunny 항목은 없었다. 범위 밖 강제 다운그레이드/자동 수정은 하지 않았다.

**실제 앱 브라우저 검증 방식**

실제 Next.js 프로덕션 빌드를 3101에서 실행하고 3100 프록시를 통해 CUA로 조작했다. 8008의 로컬 테스트 API가 기존 GIF, 인증/작업/피드백/공유 응답을 제공했다. 운영 백엔드·운영 수집 성공을 주장하는 검증은 아니다. 프록시는 Umami를 로컬 이벤트 수집으로 연결해 운영 분석에 테스트 이벤트를 보내지 않았고, 다운로드 링크가 생성한 blob을 로컬에서 관찰·보관했다. 제품 코드는 테스트용으로 대체하지 않았다.

- 합성 결과·내 결과 모달·알림 결과에서 동일 툴바와 장면 선택 확인.
- 재생/정지, 형식 메뉴, 장면 선택·이전/다음·End 키로 마지막 장면 이동, 다시 만들기 복귀 확인.
- GIF 내보내기 바이트가 응답 원본과 동일함을 확인.
- PNG 3번째 장면 480×480을 FFmpeg의 독립 추출 결과와 RGBA 픽셀 비교: 완전 일치.
- MP4 생성 파일 ffprobe: H264, 480×480, 20프레임, 2.520000초. 원본 GIF와 20개 프레임 타임스탬프 모두 일치.
- 이미지 클립보드 write API 완료와 성공 안내 확인. 링크는 실제 공유 API 응답을 받아 write API 완료·result_shared(method:link_copy)를 확인. 공개 결과 URL이 기존 화면으로 열리는 것도 확인.
- 만족도 PUT 1회 후 감사 상태 표시. 내 결과/알림에 돌아와도 동일 응답 유지. 만족도 제출이 저장·복사를 막지 않음.
- 403 파일 접근 거절 → 내보내기 준비 오류/장면·파일 공유 비활성화 → 재시도 후 복구 확인.
- 401 세션 만료 → 이전 결과 및 내보내기 컨트롤 제거, 기존 접근 불가 안내 확인.
- 320px / 390px / 1280px 가로 넘침 없음. 좁은 모달 툴바 아이콘 44px 확인.
- 정상 흐름 콘솔에서 JS 오류 없음. 권한 실패 테스트에서 의도한 403/401 네트워크 오류는 별도로 발생했다.

**미확인 범위**

브라우저 도구의 download 완료 콜백은 타임아웃되어 OS 파일 저장 완료를 자동 검증하지 못했다. 위 GIF·PNG·MP4 검사는 제품의 다운로드 링크에 전달된 실제 blob 바이트를 로컬 관찰기로 가져와 검증한 것이다. 외부 앱 붙여넣기, iOS/Android 공유 대상 목록, 카카오톡/디스코드/인스타 DM 전송·수신은 미검증이다. 실제 운영 인증/자산/분석 수집 및 새 합성 결과에 대한 운영 점검은 배포와 별개로 남는다.

## 계측 의미

- 기존 `composition_result_viewed`는 실제 이미지/디코딩된 결과가 화면에 보일 때 기록, job/source 기준 중복 방지.
- 기존 `result_downloaded`는 GIF 다운로드 시도. 저장 완료가 아니다.
- 기존 `result_share_attempted` / `result_shared` / `result_share_failed`는 공개 링크 복사 흐름 유지. `result_shared.method=link_copy`는 외부 발송이 아니다.
- 신규 `result_export_download_attempted`는 `format=png|mp4`, PNG에는 `frame` 포함. 기존 GIF 수치를 넓히지 않았다.
- 신규 `result_image_copied`는 PNG 클립보드 API 성공. 외부 앱에서의 사용을 의미하지 않는다.
- 신규 `result_file_share_attempted` / `result_file_share_resolved` / `result_file_share_failed`는 OS 공유 API 호출·Promise 완료·실패. resolved를 외부 전달/사용 완료로 해석하지 않는다.
- 준비·변환 실패: `result_export_load_failed`, `result_mp4_conversion_failed`.
- 기존 만족도/재시작 이벤트를 유지. 실제 수집 서버의 적재 여부는 이번 로컬 기록만으로 판단하지 않는다.

---

# Onboarding / GIF browser integration QA

Date: 2026-10-15 (Asia/Seoul)

## Latest revision — compact consent execution area (2026-10-15)

- User selected displayed option 2 and requested smaller consent plus local browser preview.
- Production ComposePanel retains GIF/photo geometry and places compact consent left / create right under a shared divider. Below 700px the action stacks.
- Consent: 12px body, 14px all-consent, 16px checkboxes; desktop 32px rows / mobile 40px rows. Copy: 이번 만들기에 1회 사용. Consent and request logic unchanged.
- TypeScript (--noEmit --incremental false), targeted ComposePanel ESLint and diff whitespace checks passed.
- Local preview: http://127.0.0.1:4173/ . Same updated CSS Module, existing sample assets, mock consent controls; no backend/API integration.
- Preview checked at 1280, 390 and 320px: no horizontal overflow; all/individual consent gates, deletion/reset and preview-only create verified. Console errors/warnings empty.
- Preview QA: /Users/gigcot/.codex/visualizations/2026/10/14/01a13b53-9faf-7981-a2ab-a167ea7290df/compose-consent-preview/design-qa.md
- preview final result: passed. Production /compose browser flow, real upload, synthesis and E2E were NOT verified. Earlier production QA gaps remain.

## Previous revision — 합성 재료 좌우 배치 및 탐색 복귀

- `/compose` 준비 화면: 700px 이상에서는 GIF 왼쪽·사진 오른쪽, 모바일에서는 위·아래. 전체 작업 영역은 최대 960px이며 두 이미지 모두 전체 비율을 유지한다. 사진은 파일 목록형 썸네일 대신 해당 영역 중앙에 표시한다.
- 두 영역 위에 `원본 GIF` / `넣은 사진`과 바꾸기를 배치했다. `이 조합으로 만들기` 제목을 제거하고 공통 실행부의 `만들기`를 유지했다. 사진 선택 전 `+`와 이미지 아이콘 버튼, 필수 동의와 사용 횟수 안내는 유지한다.
- GIF 바꾸기는 보관 중인 사진을 기존 IndexedDB 전달 경로에 저장한 뒤 `/?browse=1`로 이동한다. 홈 탐색의 기존 검색어·분류·결과·스크롤 복원 기능을 사용한다. 새 GIF 선택 후 합성 화면에 돌아오면 사진을 복원한다. 사진 복원을 새 사진 선택 이벤트로 중복 집계하지 않는다.
- TypeScript, 변경 소스·테스트 ESLint, Webpack 프로덕션 빌드, 기존 단위 테스트 15개, diff 공백 검사 통과.
- E2E 소스는 320px / 1440px 배치, 분류·검색·스크롤 복귀, 사진 바이트 보존, 새 GIF 반영, 삭제한 사진의 재등장 방지로 갱신했다. 실행은 하지 않았다.
- 기존 CUA의 로컬 페이지 보안 차단으로 실제 브라우저 렌더링과 파일 보존 왕복 동작은 검증 전이다. 다른 브라우저·Playwright로 우회하지 않았다. 아래 결과는 과거 변경의 이력이다.

visual / browser verification: blocked

## Previous revision — 합성 화면 2안 적용

- 사용자가 선택한 두 번째 시안: `/Users/gigcot/.codex/generated_images/01a132f5-00b9-7bb3-b162-1628c14e39a7/exec-5906b6e3-2342-4d9e-b4a3-3fe82b265d03.png`. 사진 선택 전·후 두 모바일 상태를 함께 보여주는 생성 이미지이며 이번 작업에서 직접 열어 확인했다.
- 구현 위치: `/compose`. 원본 GIF를 위에 넓게 표시하고, 아래의 고정된 가로 사진 영역을 실제 사진으로 채운다. 원본과 사진 모두 `object-fit: contain`으로 전체 비율을 유지한다. 사진을 작게 잘라 보여주던 시안과 달리 전체 사진을 보존하는 것은 사용자의 명시적인 수정 요청이다.
- 원본의 실제 GIF URL을 `<img>`로 표시한다. 별도 정지 이미지나 새 합성 결과를 만들지 않는다. 원본 제목·프레임 수를 제거하고 사진을 넣은 뒤에만 필수 동의와 만들기를 표시한다. 동의 저장, 세션, 업로드, 합성 요청, 프레임 축소 확인 분기는 유지한다.
- 사진 처리 안내는 사진 선택 전에도 접근할 수 있다. 필수 동의는 자동 선택하지 않는다. 기존 대기 화면은 이번 변경 범위 밖이다.
- CSS Modules로 준비 화면 스타일을 분리했다. 기존 검정·보라색, 폰트, Radix 아이콘을 재사용한다. 모바일은 위·아래 배치를 유지하고 데스크톱에서는 최대 552px 폭으로 제한한다. 첫 이용 시 동의 영역까지 확인하려면 세로 스크롤이 필요할 수 있다.

**검증**

- `npx tsc --noEmit`, 변경 소스·E2E 파일 ESLint, `npm run build -- --webpack`, 기존 단위 테스트 15개, `git diff --check` 통과.
- 기존 E2E의 제목·접근성 선택자를 갱신하고 사진 삭제 후 원본 유지 및 사진 선택 상태 복귀 검증을 보완했다. 브라우저 테스트는 실행하지 않았다.
- 앞선 CUA 로컬 페이지 접근이 브라우저 보안 정책으로 차단된 상태이므로, Playwright나 다른 브라우저를 통한 우회는 하지 않았다. 이번 구현의 실제 GIF 재생, 파일 선택기, 터치, 렌더링·콘솔·반응형 배치는 검증 전이다.

**시각 비교 상태**

- 목표 화면: 동일한 모바일 뷰포트에서 사진 선택 전·후. 추가 확인 대상은 320px 모바일과 데스크톱이다.
- 구현 캡처, 이미지 밀도 정규화, 원본/구현 나란히 비교: 브라우저 접근 차단으로 수행하지 못했다. 저장된 과거 캡처를 이번 구현의 증거로 사용하지 않았다.
- 폰트/줄바꿈, 간격/영역 비율, 색상/대비, 이미지 크롭/선명도, 문구/동작: 코드 수준 반영만 확인했으며 실제 시각 적합성 판정은 보류한다. 정적 검사와 빌드 성공을 시각 QA 통과로 간주하지 않는다.
- 소스 이미지를 열고 구현 및 정적 검증을 마쳤다. 남은 작업은 브라우저 접근 복구 후 사진 전·후 상태를 캡처하고 비교하는 것이다.

final result: blocked

아래 보고서는 이전 변경의 검증 이력이며 위 합성 화면 변경을 포함하지 않는다.

## Search assistance follow-up

- Added the small English-search hint inside the existing suggestion panel, only while suggestions are visible. No permanent copy added to the browsing surface.
- Korean initials (`ㅇ`, `ㅌ`, `ㄷㅂ`) and mixed input (`담ㅂ`) now match Korean topic labels. Selection still submits the mapped English query; the visible input retains the Korean label.
- Inspected the live mobile panel at 393 × 852: `qa/onboarding-integration/25-initial-search-mobile.jpg`. The hint and six suggestion rows fit without clipping; existing type, colors, media and layout remain intact.
- Validation: lint, Webpack production build/TypeScript and 15 unit tests passed. Three focused Chromium cases passed: initial suggestions/hint/English submission at 320px and 1280px, and existing Korean topic/history restoration. Tests also cover empty input, mixed syllables, literal punctuation, deduplication and dismissal. No remaining actionable issue for this change.

final result: passed

## 2026-10-14 — 홈 선택 바 초안

- 홈 타일 클릭은 선택 표시와 목록 아래 선택 바를 보여준다. 확대는 보조 버튼이며, 자동 축소와 물음표 연출은 제거했다.
- 후속 피드백 반영: 선택 바와 확대 화면의 “사진 고르기”는 선택한 GIF를 전달하고 합성 화면으로 이동한다. 홈에서는 파일 선택기를 열지 않는다. 실제 사진 선택과 조합 확인은 기존 합성 화면에서 진행한다.
- 데스크톱에서는 결과 영역 안에 최대 540px 선택 바를 두고, 모바일에서는 확대를 아이콘으로 줄인다. 목록과 선택 바는 별도 영역이므로 바가 GIF 위를 덮지 않는다.
- TypeScript, 변경 소스 ESLint, CSS 파싱, 단위 테스트 15개 통과. 기존 E2E는 새 홈 흐름에 맞게 갱신하되 이번 턴 실행하지 않았다.
- CUA가 로컬 페이지 접근을 브라우저 보안 정책으로 차단했다. 다른 브라우저나 Playwright 실행으로 우회하지 않았다. 이 초안의 실제 데스크톱·모바일 렌더링, 파일 선택기, 탐색 복귀 동작은 아직 시각·브라우저 검증 전이다. 위의 과거 검증 결과는 이 변경을 포함하지 않는다.

## Latest revision — explicit return and category drawer

The user's next review replaces automatic upward stage navigation with an explicit return action and changes category controls. The previous reports below are history.

**Findings:** no remaining actionable P0/P1/P2 issue in inspected states. The header's local stacking order was adjusted so the return control remains above either header variant.

- Upward overscroll reveals a small chevron button in the header center; the GIF list remains open until click/tap/Enter. Continuing down hides the button. PageUp reveals and focuses it. Forward movement from examples is unchanged.
- The desktop category toggle collapses the sidebar and expands the list without resetting query/results or requesting them again.
- The mobile category dialog now slides in from the left, with a single scrollable column, fixed close control and contained background. Selecting a category closes it. Escape/backdrop dismissal and nested composition-dialog focus remain intact.

**Visual evidence:** source `qa/onboarding-integration/18-clean-desktop-results.jpg` versus `24-dancing-return-arrow.jpg`, both 1280 × 720, same Dancing category results; `07-mobile-categories.jpg` versus `23-mobile-category-drawer.jpg`, both 393 × 852, same open category selector with “전체 장면” selected. The blurred background differs from the earlier capture, so only the category surface is judged in that comparison. Sources and captures are 1 pixel per CSS pixel; no rescaling, with 28px comparison labels added.

Opened and inspected `compare-return-controls.jpg`, its native-scale controls crop `compare-return-controls-detail.jpg`, and `compare-category-drawer.jpg`. The drawer is readable at native 393px scale without an additional crop. Extra states: `21-return-arrow-desktop.jpg`, `22-sidebar-collapsed.jpg`. Animated frames differ; media sources remain unchanged.

Required surfaces: font family/weights retained, with larger readable single-row category text; desktop search/grid spacing retained when expanded and width reclaimed when collapsed; existing dark/purple colors and selected states retained; no image assets changed; copy stays concise with icon-only return and accessible labels. The drawer's side placement and one-column density are intentional requested differences. Controls fit the mobile viewport and selected rows remain distinct.

**Validation:** lint passed; production build and TypeScript passed using `npm run build -- --webpack`. Default Turbopack could not create an internal port in this execution environment. Fifteen focused production Chromium cases passed: wheel/touch return confirmation, keyboard focus, category collapse state preservation, sidebar/dialog isolation, mobile drawer placement/scroll/selection, responsive captures at 320/390/768/1440, composition photo retention/nested modal focus and browser-back restoration. Manual checks used the actual local app, and the browser console returned no warning/error entries. Touch-handler tests do not substitute for physical iOS/Safari momentum verification.

Checklist: [x] explicit return [x] desktop collapse [x] mobile drawer [x] visual comparison [x] build and relevant regressions. Gesture feel remains open to user review; composition-screen UX remains the next task.

final result: passed

## Previous revision — quieter copy and stage scrolling

This revision implements the user's review of the integrated local app. Earlier integration findings and comparisons are retained below as history; the copy and scrolling described in this section supersede them.

**Requested changes**

- Removed redundant example/chat labels; kept the chat situation and small “원본” / “합성한 짤” labels.
- Removed the step number, sidebar heading, large topic headings/counts, duplicate provider line, topic-local search and back-to-examples link.
- Kept the small browsing hint, selection tips, global search and functional topic breadcrumb.
- Preview now contains the media, original title, close control and “이걸로 할래요”; its accessible heading is visually hidden.
- Added resisted boundary scrolling between examples and browsing, plus independent contained category/result scrolling. Desktop wheel travel is 58%; native touch movement inside lists is unchanged.

**Visual evidence**

Capture root: `qa/onboarding-integration/`. The source for this revision is the prior integrated app plus the user's explicit removals, rather than an unchanged prototype.

| State | Before | After | CSS viewport / image dimensions |
| --- | --- | --- | --- |
| Desktop Dancing results | `11-desktop-results-final.jpg` | `18-clean-desktop-results.jpg` | 1280 × 720 |
| Mobile GIF preview | `10-mobile-preview.jpg` | `17-clean-mobile-preview.jpg` | 393 × 852 |
| Desktop topics | `04-desktop-actions.jpg` | `15-clean-actions.jpg` | 1280 × 720 |
| Mobile results | `09-mobile-results.jpg` | `16-clean-mobile-results.jpg` | 393 × 852 |

Opened and inspected the before/after canvases `compare-clean-desktop.jpg` and `compare-clean-preview.jpg`. Images remain at 1 image pixel per CSS pixel with no rescaling; only a 28px label strip is added. The complete narrow preview comparison is readable at native size, so no additional crop was needed. The desktop grid begins about 78px higher after removing the redundant rows. Animated frames differ between captures. `19-clean-hero-result.jpg` and `20-clean-game-chat.jpg` verify compact result/situation labels at 1280 × 720.

**Required fidelity surfaces**

- Typography: existing font stack, weights and Korean line wrapping preserved; removed copy does not leave empty heading space.
- Spacing/layout: header and search remain visible; desktop category rail and dense results scroll independently. Mobile retains two columns and a fitting preview. No clipping found at tested widths 320, 390/393, 768 and 1440.
- Colors/tokens: existing dark surfaces, purple selected states and primary actions retained.
- Assets/image quality: approved local media and real KLIPY media preserved; preview retains full-image fit. No replacement/generated placeholders introduced.
- Copy/content: compact source/result labels and “이걸로 할래요” match the request. Questions and repeated category labels are removed.
- Controls/access: accessible headings retained, modal scroll/focus isolation and photo retention verified. PageDown/PageUp provide stage navigation; reduced motion disables the new movement animation.

**Findings and checks**

- [P2, fixed] The root footer allowed outer-page scrolling alongside the internal panels and could displace the header. Home now embeds the footer at the end of the browsing list. DOM checks and regression assertions confirm document height equals viewport height and window scroll stays at zero.
- Manually verified the actual app's stage transitions in both directions, independent panel scrolling, desktop layout and mobile category/preview layout.
- Production build, TypeScript and lint passed. Relevant five-file Chromium suite: 51 passed, 1 explicit live-Umami opt-in skipped. After the final footer adjustment, rebuilt and reran 13 focused cases successfully; these are repetitions, not 13 additional unique cases.
- Coverage includes thresholded wheel movement, reduced wheel travel, sidebar boundary isolation, modal isolation, touch handlers, history/query/scroll restoration, anonymous journey, photo retention, media loading and responsive captures. Composition/payment calls were mocked.
- Touch-handler regressions dispatch DOM touch events; physical-device momentum and iOS Safari have not been verified. Gesture feel remains for the user's hands-on review. No remaining actionable P0/P1/P2 finding in the inspected states.

final result: passed

## Previous integration QA

**Findings**

- [P2, fixed] A 720px-tall desktop viewport pushed the onboarding actions below the first screen. Evidence: `qa/onboarding-integration/01-desktop-hero.jpg`. Reduced the stage height and headline spacing only for short desktop viewports in `HeroOnboarding.module.css`. Post-fix evidence: `06-desktop-hero-final.jpg`; at 1280 × 720 and scrollY 0, both actions are visible without clipping.
- [P2, fixed] Returning from composition intermittently restored the query and 48 results but reset scroll from 1813 to 0. Reproduced 3/10 times without diagnostic delays. Scroll tracking could outlive the departing DOM and save the next route's position. Moved the tracking effect cleanup to `useLayoutEffect`; source type/lint checks and production rebuild pass. The same regression passed 10/10 repetitions after the fix; related composition-sheet cases passed at 320px and 1440px.

**Visual truth and comparison evidence**

Source root: `/Users/gigcot/projs/gifgloo/gifgloo-frontend/prototypes/onboarding-preview/qa/`.

Implementation: `http://127.0.0.1:3000/` and `/?browse=1`. Capture root: `/Users/gigcot/projs/gifgloo/gifgloo-frontend/qa/onboarding-integration/`.

| State | Source visual truth | Implementation screenshot | CSS viewport / both images |
| --- | --- | --- | --- |
| Dog result, first story, paused | `20261014-story/02-result-desktop.jpg` | `14-desktop-dog-result.jpg` | 1144 × 837 |
| Actions / Dancing results, dark, anonymous | `20261014-browse-prototype/04-dancing.jpg` | `11-desktop-results-final.jpg` | 1280 × 720 |
| Reactions / Sigh results, dark, anonymous | `20261014-browse-prototype/11-mobile-final.jpg` | `13-mobile-sigh.jpg` | 393 × 852 |

Full-view comparisons were assembled and opened as `compare-dog-result.jpg`, `compare-desktop-results.jpg`, and `compare-mobile-results.jpg`. Each source and implementation screenshot was compared at equal pixel dimensions, 1 image pixel per CSS pixel; no density rescaling. Comparison canvases add only a 28px label strip. Animated media frames differ because the captures were made at different playback times. This does not indicate different source assets.

The 1:1 crops in `compare-results-detail.jpg` compare the topic heading, topic chips, result count and beginning of the grid. Both are readable at native scale. Additional responsive evidence: `06-desktop-hero-final.jpg` (1280 × 720), `03-mobile-hero.jpg`, `07-mobile-categories.jpg`, `08-mobile-actions.jpg`, `09-mobile-results.jpg`, `10-mobile-preview.jpg` (393 × 852), and `12-tablet-results.jpg` (768 × 1024).

**Required fidelity surfaces**

- Fonts and typography: preserved the prototype's bold two-line example title, purple emphasized subject, compact sans-serif UI and distinction between topic heading and metadata. The real app uses its existing font stack. Native-scale comparison shows readable Korean text, consistent weights and no cramped wrapping. The large question heading was intentionally removed following the user's latest feedback.
- Spacing and layout: retained the centered 480px example stage, compact next/pause controls and full-width primary action. Desktop exploration keeps a persistent category rail and dense masonry results; mobile uses two columns and a category dialog. Native header/auth controls add some desktop vertical space. Mobile removal of the large heading and category strip brings results substantially higher. These are accepted integration differences.
- Colors and tokens: retained the near-black page, muted purple search/card surfaces and saturated purple CTA/selected states. The actual service header and standard Radix icons are used. No new decorative illustration or generated placeholder replaces source imagery.
- Image quality: the three local approved examples use the same source, target and result files as the prototype. Search cards preserve the supplied media aspect ratios and use actual KLIPY results. Modal previews show full media without forced square cropping. No visible halos or new compression defects were introduced.
- Copy and content: the small hint is “넣고 싶은 대상을 떠올리며 둘러보세요.” Selection tips discuss visible expressions/movement and subject visibility, not frames. The preview separates looking from committing with “이 GIF에 사진 넣기”. Personalization is demonstrated through source/photo/result/chat phases rather than an extra static explanation block.
- Icons, controls and access: only next and pause/play are present in the story controls; how-to, category and GIF dialogs expose close controls and labelled headings. Mobile CTA and close controls fit the viewport. Keyboard focus restoration, dialog scroll release and photo retention are covered by browser regressions. Reduced motion stops automatic story changes and MP4 playback; original animated GIF images can still animate (follow-up limitation).

**Interaction checks**

- Manually verified actual landing → start → categories → topic → live KLIPY results → preview → composition handoff. Verified back navigation retains the selected query and results, and more-results appends the next page.
- Verified story pause/next/how-to and the mobile category sheet and preview. Captured desktop, tablet and mobile layouts. At 1280 × 720 the page has no horizontal overflow and the primary/how-to actions fit.
- Browser console check on the live onboarding/exploration flow returned no warning/error entries.
- Production build, lint, TypeScript and 12 unit tests passed. Chromium suite: 72 unique cases passed, 1 explicit live-Umami opt-in test skipped. The interrupted full run completed 58 cases plus the skip; resumed asset cases added 11 and navigation cases added 3. After fixing scroll restoration, repeated that case 10 times and reran the two related composition-sheet cases successfully. These repetitions are not added to the 72 unique case count. The suite covers anonymous journey, login return, photo retention, errors/retries, job return, result/download/share and assets, with paid composition/payment mocked.

**Comparison history**

1. Initial desktop comparison found the short-height CTA issue; result blocked. Applied responsive height/spacing changes.
2. Recaptured at 1280 × 720 with scrollY 0 and compared the standard 1144 × 837 dog result against the source. Both CTA visibility and normal-sized layout are confirmed. No remaining P0/P1/P2 visual mismatch.
3. Functional regression found intermittent scroll loss; result blocked until fixed. The layout-effect cleanup fix passed 10/10 repetitions and both related 320px/1440px sheet regressions. No remaining actionable P0/P1/P2 finding.

**Open questions / limits**

- The local backend is not running. Authentication, credits and real composition success require a backend; paid actions were not performed.
- KLIPY taxonomy is a static reviewed snapshot, and Korean assistance maps known topics to English. This is not automatic taxonomy synchronization or general-purpose translation.
- Personal example files and screenshots remain ignored local assets. The local flag is required to see the approved three stories; normal builds use existing tracked fallback media.
- Next.js dev-tool badge appears in development captures and is absent from production.
- Exhaustive screen-reader, text-zoom and cross-browser testing was not performed.

**Implementation checklist**

- [x] Preserve source visuals and accepted copy changes.
- [x] Integrate actual search and canonical GIF handoff without owning the composition photo.
- [x] Inspect desktop / mobile / tablet renderings and dialogs.
- [x] Fix short-height desktop CTA visibility.
- [x] Finish repeated navigation regression verification after the scroll fix.

**Follow-up polish**

Composition-screen wording, upload guidance and progress expectations are the next UX review. Revisit original GIF reduced-motion handling when preparing public onboarding assets.

final result: passed
