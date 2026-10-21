# Gifgloo PostHog 계측

기존 커스텀 이벤트·UTM·flow/attempt/job·origin 계약을 보존한 전송 이전이다. 개인적 의미·실제 활용·새 목적 재사용·지불 가치는 이벤트 수만으로 판정하지 않는다. Umami의 과거 데이터와 보드는 보존한다.

## 연결

1. PostHog US/EU 무료 프로젝트를 만든다.
2. Personal API key에 해당 프로젝트의 `project:read`, `dashboard:read/write`, `insight:read/write`, `query:read`를 부여한다.
3. Git에서 제외된 `.env.posthog.local`에 `POSTHOG_APP_HOST`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY`를 저장한다. 개인 키는 브라우저 번들이나 공개 변수에 넣지 않는다.
4. `python3 -B scripts/setup_posthog.py --validate`로 변경안과 읽기 쿼리를 확인한다.
5. `python3 -B scripts/setup_posthog.py --apply --prepare-runtime`으로 분석·대시보드를 적용하고 로컬 SDK용 공개 변수 두 개만 `.env.local`에 갱신한다.

설정 스크립트는 기존 상태를 `.posthog/`에 비공개 백업하고, 관리 태그가 있는 항목만 생성·갱신한 뒤 재조회한다. 재실행해도 중복을 만들지 않는다. 무관한 분석·다른 대시보드 연결·추가 태그는 유지한다. 삭제·공유·결제 설정은 변경하지 않는다.

운영 빌드에는 GitHub `env` environment의 `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST` 공개 변수가 필요하다. 프로젝트 token은 API 쓰기용 Personal key와 다르다. `POSTHOG_PERSONAL_API_KEY`를 운영 브라우저 설정으로 배포하지 않는다.

## 수집 계약

- 명시적 이벤트 전송: `shared/lib/analytics.ts`. schema 2·기존 experience version, UTM 최초 귀속, 현재 flow/attempt와 원래 job 맥락을 유지한다.
- SDK는 `instrumentation-client.ts`에서 초기화한다. 자동 클릭 수집·세션 녹화·설문·오류 자동 수집·feature flags는 비활성화한다. 마케팅 파라미터 자동 저장도 끄고 기존 UTM 최초 귀속 값을 사용한다. 기존 웹 성능 측정 용도의 web vitals와 페이지 조회는 PostHog 이름으로 수집한다.
- 인증 상태 조회가 끝날 때까지 초기 이벤트를 보관한다. 계정 전환·로그아웃 때 SDK 식별자를 초기화하고, 발생 시각·계정·원래 작업 맥락을 전송 시점의 값으로 바꾸지 않는다.
- URL/referrer와 최초 사용자 속성의 URL에서 query/hash를 제거한다. 이메일·원본 사진·파일명·원시 검색어는 추가하지 않는다.
- `distinct_id`는 분석 식별자이며 사람 수의 직접 증거가 아니다. `account_id`는 기존 서버 UUID이고 익명 계정도 포함한다.

## 분석의 의미

`definitions.py`는 질문에 필요한 9개 SQL 분석과 한국어 대시보드의 기준이다. SQL의 `{filters}`로 보고서 날짜 범위를 적용한다. 기본 최근 7일은 화면 조회 범위이고 회차 기간·후속 관찰창·성공 임계치가 아니다.

- 첫 결과/콘텐츠/재료 선택은 기간 내 도착 flow와 그 뒤의 첫 접수 job을 연결한다. 첫 접수 시각이 같은 여러 job은 첫 job 선택 불명확으로 분리한다. 준비 단계는 첫 접수 이전의 각 신호 관측 수이며 순차 퍼널 전환율로 해석하지 않는다. 직접 `/compose` 진입은 별도 경로다. 과거부터 유지된 탭은 기간 내 도착 이벤트가 없을 수 있어 미연결 접수로 남긴다.
- 모든 후속 행동은 같은 조회 기간 내의 관측이며 기간 밖 완료·저장·복귀는 포함하지 않는다. 결과 미표시를 이탈이나 무가치로 확정하지 않는다.
- 저장 시작·파일 저장 시도·복사·파일 공유 API 응답은 다른 신호다. 같은 job의 결과 표시 뒤 행동만 후속 행동으로 센다.
- 완료·실패는 브라우저 관측이다. 서버 전체 상태·환불·지불·최초 평가 저장의 기준은 서버 DB다.
- schema2·external에서 알려진 QA 캠페인/source와 localhost를 제외한다. `external`은 자연 이용 확정이 아니다. 운영자 계정은 `.env.posthog.local`의 `POSTHOG_INTERNAL_ACCOUNT_IDS` 쉼표 목록으로 추가 제외할 수 있다. 미등록 상태에서는 포함 가능성을 유지한다.
- QA·출처·버전 보기에는 전체를 포함해 미계측/unknown/미적용을 드러낸다. 출처 없는 접수·결과를 퍼널의 빠진 단계에 임의로 채우지 않는다.
- 재접수 단서에는 모든 재사용이 포함되지 않는다. 실패 복구·품질 탐색·재미·새 목적은 사용자 설명/실제 행동으로 구분한다.

## 검증

- `npm run test:unit`: 큐·계정 전환·origin·기존 입력/결과 행동 계약.
- `python3 -B -m unittest discover -s tests/posthog -v`: API 설정의 계획/재적용/중복 방지/무관한 연결 보존.
- `npx playwright test`: 기존 사용자 흐름의 mock 회귀. 테스트 SDK host는 loopback이며 실제 합성·운영 분석 송신을 하지 않는다.
- `posthog-transport.spec.ts`: 실제 SDK를 로컬 수신 mock에 연결해 payload·스키마·UTM·URL 민감값 제거를 검증한다.

SDK 설치 시 표시된 npm audit 결과는 기존 lockfile과 비교한다. 이 작업과 무관한 일괄 의존성 업그레이드는 하지 않는다.
