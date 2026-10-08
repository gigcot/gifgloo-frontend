# 첫 체험 화면 통합 검수 — 2026-10-08 검증 갱신

화면 비교 결과: passed. 아래 계측 회귀 검증에는 WebKit 다운로드 미해결 1건이 별도로 남아 있다.

승인한 시안의 화면 구현·로컬 검수 결과다. 운영 배포, 실제 사용자 효과, OS 푸시 수신, 법적 적합성의 완료 판정이 아니다. 별도 리뷰어 없이 자체 검토했다.

## 바로 볼 화면

- [모바일 전체 흐름](qa/first-experience/overview-mobile.png)
- [홈](qa/first-experience/home-390.png) · [사진 입력](qa/first-experience/input-390.png) · [대기](qa/first-experience/waiting-390.png) · [결과](qa/first-experience/result-390.png)
- [최초 필수 동의가 있는 입력](test-results/anonymous-mobile.png)
- [데스크톱 입력](qa/first-experience/input-1440.png) · [데스크톱 결과](qa/first-experience/result-1440.png)

## 기준·비교 조건

프로젝트 루트: `/Users/gigcot/projs/gifgloo/gifgloo-frontend`.

| 화면 | source visual truth (루트 기준) | implementation screenshot |
| --- | --- | --- |
| 홈 3안 | `test-results/home-option3-prototype/qa/frames/home-{390,1440}.png` | `qa/first-experience/home-{390,1440}.png` |
| 사진 입력 2안 | `test-results/home-option3-prototype/qa/frames/compose-{390,1440}-ready.png` | `qa/first-experience/input-{390,1440}.png` |
| 대기 1안 | `test-results/home-option3-prototype/qa/waiting/{390,1440}-normal.png` | `qa/first-experience/waiting-{390,1440}.png` |
| 결과 제목 상단 1안 | `test-results/home-option3-prototype/qa/result/{390,1440}-normal.png` | `qa/first-experience/result-{390,1440}.png` |

- Playwright로 실제 제품 코드를 렌더링했다. API·알림 권한·합성 완료는 모의 응답이며 실제 생성·푸시는 호출하지 않았다.
- 비교 viewport: 모바일 390×844, 데스크톱 1440×1000 CSS px. 양쪽 deviceScaleFactor=1, 이미지 크기도 동일하다. 홈 원본만 full-page 390×1555 / 1440×1456이므로 위에서 각각 844/1000px를 같은 배율로 잘랐다.
- 추가 320×844, 768×1000 화면을 확인했다. 가로 넘침 없음. Firefox·WebKit의 추가 캡처는 각각 `qa/first-experience/firefox/`, `webkit/`에 있다.
- 상태: 기존 익명 세션, 사진 준비 완료 → 서버 접수 → 완료. 최초 동의는 별도 익명 회귀 테스트에서 확인했다. 홈 원본의 미식별 로그인 버튼과 실제 캡처의 기존 비회원 잔량·내 결과 표시는 서로 다른 세션 상태이며 레이아웃 오류가 아니다.
- 프레임 수 원본 26 / 테스트 20은 자료 차이다. 프레임 검사는 실제 Worker가 테스트 GIF 바이트를 읽는다. 홈 동영상은 정지한 시점이 달라 같은 소재의 다른 프레임이다.
- 결과 원본은 시연용 MP4라 재생 버튼이 있지만 실제 서버 결과는 GIF `<img>`다. 작동하지 않는 재생 버튼을 제품에 복제하지 않았다. ‘화면 검토용’ 문구도 제품에는 넣지 않았다.

전체 비교는 `qa/first-experience/compare-{home,input,waiting,result}-{390,1440}.png`에서 **왼쪽 시안 / 오른쪽 제품**으로 한 이미지에 결합해 확인했다. 확대 비교는 `compare-result-actions.png`(각 480×340, 1:1)에서 버튼·아이콘·평가 문구를 확인했다. 모바일 전체 비교는 원본 크기로 읽을 수 있다.

## 발견 사항과 수정 이력

1. **[P1, 수정] 배경·브랜드 색상 누락**: 최초 실제 렌더에서 중첩 CSS의 부모 선언이 사라져 흰 배경·낮은 대비·보이지 않는 버튼이 나타났다. `before-input-390.png`에 초기 결합 증거를 보존했다. 테마 선언을 독립 규칙으로 분리하고 실제 hero 배경/본문색 CSS assertion을 추가했다. 최종 전체 비교에서 보라색/검정/흰색 및 버튼 경계를 다시 확인했다.
2. **[P2, 수정] 결과 링크 복사 아이콘 불일치**: 기존 공유 아이콘 대신 시안의 Radix Link2Icon을 사용했다. 최종 `compare-result-actions.png`에서 재확인했다.
3. **[P2, 수정] 알림 아래 빈 상태 문구 여백**: 빈 메시지의 margin 때문에 복귀 안내가 밀렸다. 빈 상태는 표시하지 않도록 수정하고 최종 `compare-waiting-390.png`에서 간격을 재확인했다.
4. 렌더링 외 결함: Worker의 module/importScripts 충돌, 대기 제목의 잘못된 status role, 중첩 keyframes 빌드 경고, 접수 직후 잔량 미갱신을 수정했다. 연결 끊김을 합성 실패로 표시하지 않고 재연결 안내로 구분했다. 각각 코드 검사·브라우저 회귀로 확인했다.

최종 비교에 남은 조치 가능한 P0/P1/P2 시각적 차이는 없다. 홈 데스크톱 헤더 높이 60→70px는 익명 잔량·내 결과 헤더 통합에 따른 차이이며 모바일은 60px다. 다른 미디어 정렬의 작은 차이와 동영상 프레임 차이는 주요 영역의 비율이나 조작을 바꾸지 않는다.

## 필수 표면 점검

- **글꼴·타이포그래피**: 시안과 같은 Arial 및 한국어 시스템 fallback을 사용했다. 모바일 제목/줄바꿈, 안내의 크기·행간, 결과 제목과 작은 평가 문구의 위계가 유지된다. 다른 OS의 실제 폰트 렌더링은 실기기 확인 대상이다.
- **간격·구조**: 홈의 예시/선택 분리, 사진 미리보기, 대기의 중앙 정렬, 결과→저장/복사→재시도→평가 순서를 유지했다. 320/390/768/1440px에서 핵심 조작이 화면 밖으로 가로 잘리지 않는다. 첫 이용 동의가 있는 경우에는 정상적인 세로 스크롤이 필요하다.
- **색·토큰**: 주색 #9809ff, 보조색 #c27bff, 배경 #0c0c0e. 저장은 주색, 복사는 테두리, 평가는 무채색. 실제 CSS 색상 검사와 렌더를 함께 확인했다.
- **이미지·아이콘**: 승인한 하마 GIF·강아지/고양이 사진·실제 합성 결과 원본을 사용했다. 제품 이미지를 도형으로 대체하지 않았다. 예시는 MP4, 선택 목록은 제공자 GIF, 결과는 서버 GIF를 사용한다. 목록은 원본 내용을 잘라내지 않도록 contain이다.
- **문구·동선**: 아래 확정 문구를 유지하며 실행 전 일반 이용권 확인 모달은 제거했다. 최초 필수 동의와 서버가 요구하는 조건부 프레임 확인은 별개다. 푸시 허용/거절이 합성을 가로막지 않는다.

## 사용자가 확인할 문구·화면

| 위치 | 이번 문구/구성 |
| --- | --- |
| 홈 | 사진 속 주인공을 GIF 속으로 / 원본 GIF·넣은 사진·합성 결과 / GIF 고르기 / 가입 없이 처음 2회 무료 |
| 탐색 | 인기·카테고리 / 선택 팁 / 20프레임 안팎이거나 그보다 적은 GIF 추천 / 이 GIF로 만들기 |
| 입력 | 어떤 사진을 넣어볼까요? / 대상이 잘 보이는 사진을 골라주세요. / 사진 처리 안내 / 만들기 |
| 최초 이용 | 처음 이용할 때 한 번 확인해요 / 전체 동의 / 필수 만 14세 이상·이용약관·개인정보처리방침 |
| 상단 | 비회원 · 사용 가능 N회 / 내 결과. 계정 연결·설문 CTA는 내 결과 화면에서 기존 기능에 접근 |
| 접수 전 | 사진을 보내고 있어요 / 접수가 끝날 때까지 이 화면을 유지해주세요. |
| 접수 후 | GIF를 만들고 있어요 / 약 2~3분 걸려요 / 완료되면 알림 받기 / 같은 브라우저의 내 결과 복귀 |
| 알림 예외 | hover/focus 미지원 가능성, 클릭 시 미지원·거절·등록 실패별 안내. 실제 서버 저장 전 성공이라고 표시하지 않음 |
| 결과 | 완성됐어요! / GIF 저장·링크 복사 / 다시 만들기 / 결과는 어땠나요? · 아쉬워요·만족해요 |

## 검증과 재실행

- 최신 계측 보완 후: Chromium 전체 43개 통과·실전송 opt-in 1개 기본 제외. 새 계측 9개는 Chromium·Firefox·WebKit에서 각각 통과했다. 익명 첫 체험 파일 전체는 Firefox 15개 통과, WebKit 14개 통과·다운로드 대기 1개 실패다. 다운로드 요청과 모의 HTTP 200/attachment 응답은 확인했지만 실제 Safari 문제인지 자동화·모의 파일 문제인지는 미확정이다. 아래 34/13/13 수치는 그 이전 화면 통합 시점의 결과다.
- 실제 Umami 수신도 내부 QA 흐름 1회에서 55개 이벤트로 확인했다. 자연 유입이나 실제 합성 성과가 아니며 운영 DB·유료 생성은 사용하지 않았다. 자세한 식별·집계·미해결 사항은 [프론트 백로그](https://app.notion.com/p/3ef920d3d99981668177d45090465a76)의 Review와 `tests/EXP-001-tracking.md`에 둔다.
- 2026-10-08 Next.js·eslint-config-next 16.4.0 및 호환 하위 의존성 업데이트 후 아래 검사·운영 빌드·Chromium 34개·Firefox 13개·WebKit 13개를 재실행했다. 화면 문구와 배치는 변경하지 않았다. 새 ESLint 규칙에서 필요한 외부 상태 동기화·로그아웃 새로고침에만 사유 있는 줄 단위 예외를 적용했고 설문 제출 후 안내 숨김은 렌더 조건으로 계산한다.
- `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`: 통과, 단위 테스트 7개.
- `NEXT_PUBLIC_API_BASE=http://localhost:8000 NEXT_PUBLIC_ANALYTICS_INTERNAL=true npm run build`: 통과.
- Chromium 전체 34개 통과. 프로덕션 빌드에서도 아래 명령으로 전체 34개 통과.
- Firefox 13개 / WebKit 13개 추가 통과(새 흐름 테스트). WebKit 엔진 테스트는 iPhone 실기기·OS 푸시 테스트가 아니다.
- 캡처 테스트에서 pageerror 수집 결과 0. 의도적으로 차단한 Umami 요청·실패 응답은 제품 장애로 집계하지 않았다. 브라우저 컨텍스트 밖의 실제 AI/푸시/결제는 호출하지 않는다.
- 실제 KLIPY 카테고리 응답 구조 확인. CDN GIF 한 건의 HEAD 응답 200, `Access-Control-Allow-Origin: *` 확인. 모든 GIF의 크기/가용성/품질을 보장하는 검증은 아니다.

```sh
# 기본 Chromium 전체 회귀 (개발 서버)
NEXT_PUBLIC_API_BASE=http://localhost:8000 NEXT_PUBLIC_ANALYTICS_INTERNAL=true npm run test:e2e -- --workers=2

# 먼저 위 환경변수로 build 후 프로덕션 빌드 회귀
E2E_PRODUCTION=true NEXT_PUBLIC_API_BASE=http://localhost:8000 NEXT_PUBLIC_ANALYTICS_INTERNAL=true npm run test:e2e -- --workers=2

# Firefox·WebKit 설치 후 새 흐름 교차 검증
E2E_PRODUCTION=true E2E_CROSS_BROWSER=true NEXT_PUBLIC_API_BASE=http://localhost:8000 NEXT_PUBLIC_ANALYTICS_INTERNAL=true npm run test:e2e -- tests/e2e/first-experience-v2.spec.ts --project=firefox --project=webkit --workers=2

# 승인된 로컬 prototype 캡처가 있을 때 비교 이미지 재생성
node tests/capture/compare-first-experience.mjs
```

테스트 출력은 `test-results/e2e-runs`를 사용해 기존 prototype을 지우지 않는다. QA PNG는 Git 제외된 로컬 산출물이다. `next start`의 standalone 안내 경고는 남으며 이 검증은 실제 배포 패키지 검증을 대신하지 않는다.

## 남은 운영 확인

- 푸시는 기본 비활성화. macOS 로컬 도구에서 실제 알림 센터 수신·클릭 복귀를 사용자가 확인했다. 운영 DB 마이그레이션·VAPID 설정·실제 제품 합성 완료부터 본인 결과 조회까지의 종단 검증, 탭/브라우저 완전 종료 및 iOS 검증은 남았다. 백엔드 `ops/web-push.md` 참조.
- 개인정보 정책에 선택적 알림 정보와 정리 시점 반영, 시행일·동의 버전 확인. 기존 약관 초안을 이번 UI 작업에서 임의로 게시하지 않았다.
- 2026-10-08 tmpfs PostgreSQL 16에서 알림 동시 선점·만료 정리·재신청 경합 등 10개와 익명 User 7개 통과. 운영 DB 적용·제품 사용자 가치 관찰은 미실행이다. 로컬 실기기 알림 전송/복귀 검증 근거는 백엔드 `ops/web-push.md`에 둔다.
- 2026-10-08 보안 업데이트 후 `npm audit --omit=dev` 경고 0개. 전체 audit에는 개발용 ESLint의 `fast-glob → micromatch → braces@3.0.3` 경로로 high 5개가 남았다. 강제 수정 제안은 eslint-config-next 14.2.35로 내리므로 적용하지 않았다. 비신뢰 glob 입력을 개발 도구에 전달하지 않고 상위 수정 버전을 재확인해야 한다. 이 수치는 보안 전체의 안전성 보증이 아니다.
- 범위별 커밋·푸시 기록은 [프론트 백로그](https://app.notion.com/p/3ef920d3d99981668177d45090465a76)의 Review에 연결한다. PR·머지·운영 배포는 수행하지 않는다. 전체 백로그는 Review, 사용자 가치 검증은 관찰 대기다.
