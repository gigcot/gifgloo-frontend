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
- 비동기 합성 요청은 시작 시점의 `flow_id`·`attempt_id`를 동의·업로드·접수·재접수 이벤트까지 유지한다. 이전 요청을 기다리며 새 시도를 시작해도 앞선 응답을 새 attempt로 집계하지 않는다.
- URL/referrer와 최초 사용자 속성의 URL, web vitals에 중첩된 `$current_url`·`navigationURL`에서도 query/hash를 제거한다. `web_vitals_attribution: false`로 성능 항목의 이미지 URL·DOM 대상을 수집하지 않는다. 이메일·원본 사진·파일명·원시 검색어는 추가하지 않는다.
- `distinct_id`는 분석 식별자이며 사람 수의 직접 증거가 아니다. `account_id`는 기존 서버 UUID이고 익명 계정도 포함한다.

## 판정 질문과 읽는 순서

판정하려는 것은 **의미 있는 대상을 원하는 GIF 장면에 넣어 표현·감상·소장할 가치를 느끼는 상황과 사용자가 있는가**다. 유입 콘텐츠에서 전달한 약속과 실제 선택·결과 경험·사용 맥락을 연결해 읽는다. 이벤트는 행동과 마찰의 근거이고, 개인적 의미·실제 사용처·재시도 이유는 정성 근거와 함께 확인한다.

1. 08·09에서 QA·구계약·도착 누락·첫 작업 동률을 확인한다.
2. 01에서 홈과 직접 진입의 어느 구간이 연결되지 않았는지 본다.
3. 02·03에서 유입/기기와 재료 조건을 한 축씩 비교한다. 작은 표본을 과도하게 쪼개거나 원인 효과로 해석하지 않는다.
4. 04·05·11·12에서 해당 flow의 실제 순서·마지막 관측·요청 단계·시간을 확인한다.
5. 10에서 결과 후 행동 분기를 보고, 06 평가·07 재접수 단서와 사용자 맥락/실제 활용 근거를 대조한다.

| 구간 | 연결할 이벤트·키 | 관측과 해석 |
| --- | --- | --- |
| H 도착 → I 만들기 의도 | home_viewed → make_intent, 같은 flow | 예시·탐색에서 만들기로 진입했는가. 전체 설명 슬라이드 완독은 필수가 아니다. |
| I → C 합성 화면 | compose_viewed, gif_restored=true, 같은 flow·순서 | 선택한 GIF가 복원됐는가. 직접 /compose 진입은 I 없이 별도 집계한다. |
| C → P 준비 | compose_inputs_ready, input_revision | GIF와 사진 조합이 준비됐는가. 사진 취소·거부·제거·예시 선택·GIF 변경은 타임라인에서 확인한다. |
| P → K 클릭 | compose_clicked, 같은 input_revision | 준비했던 바로 그 조합으로 클릭했는가. 다른 재료의 준비 이벤트를 가져오지 않는다. |
| K → J 접수 | composition_requested, 같은 attempt와 input_revision | 서버가 job을 발급했는가. 요청 단계별 실패·확인·캐시·동의는 05로 분리한다. |
| J → R 결과 | composition_result_viewed, 같은 첫 job | 로드된 결과가 보이는 상태가 됐는가. 현재 attempt로 옛 결과를 연결하지 않는다. 다른 flow/날짜의 복귀도 job으로 잇는다. |
| R → 후속 행동 | result_downloaded/export_download_attempted/image_copied/shared/file_share_*, 같은 job·결과 뒤 | 저장·복사·공유는 서로 겹칠 수 있는 분기다. GIF 다운로드 시작·OS 공유 응답을 실제 활용으로 해석하지 않는다. |
| 첫 작업 → 재접수 | composition_retried.previous_job_id → 첫 job, 새 job_id | 실패 복구와 첫 결과 뒤 재접수를 분리한다. 새로운 목적의 재사용인지 이벤트만으로 확정하지 않는다. |

**퍼널**은 순서대로 이어지는 필수 구간, **세그먼트**는 유입·재료·기기 같은 비교 조건, **코호트**는 특정 기간에 새로 들어와 함께 관찰하는 대상 묶음이다. 이번 보드는 사람 단위 PostHog Cohort/Funnel 객체 대신 flow/attempt/job을 보존한 HogQL 표를 사용한다. 같은 사람이 여러 탭이나 여러 작업을 수행한 것을 한 번의 순차 체험으로 섞지 않기 위해서다. 별도의 사용자 재방문 분석에는 계정/식별자 안정성과 관찰 기간을 먼저 정해야 한다.

## 날짜·분모·시간 계약

- 현재 프로젝트 날짜 기준은 UTC(한국시간보다 9시간 느림)다. 실제 KST 회차는 타임존을 포함한 시작·종료 절대시각으로 정하며 날짜만 보고 같은 회차라고 가정하지 않는다.
- 날짜 필터는 **새 flow 도착 코호트**를 고른다. 기본 최근 7일은 편의상 보기이며 실험 회차·성공 기준이 아니다. flow_started_at이 기간보다 이른 유지 탭·result_return·도착 없는 접수는 유입 분모에 채우지 않고 09로 진단한다. 해당 필드가 없는 구계약도 08에 남는다.
- 대시보드 속성 필터도 진입 이벤트 기준으로 코호트를 선택한다. 재료 조합 비교는 03을 사용한다. 결과 이벤트에만 있는 속성을 전역 필터로 걸어 진입 분모를 지우지 않는다.
- 도착 이후 이벤트는 조회 시각까지 읽는다. 따라서 날짜 필터 종료 후의 완료·결과·복귀도 포함한다. 추출 종료를 고정하려면 비공개 설정의 POSTHOG_OBSERVATION_CUTOFF에 타임존을 포함한 ISO 시각을 지정하고 재적용한다. KST 회차 시작/종료는 실제 실행과 합의한 뒤 입력한다.
- 현재는 **열린 관찰**이다. 04에서 도착 후 관찰 나이·추출 시각·마지막 관측을 확인한다. 서로 다른 관찰 나이의 결과를 완결 전환율/이탈률로 판정하지 않는다. 같은 시간 동안 지켜본 성숙 코호트나 고정 후속 관찰창은 아직 합의하지 않았다.
- 같은 flow에서 첫 접수를 고르고, 동일 위치의 여러 job은 불명확으로 분리한다. H/I/C/P/K는 첫 접수 전 신호만 사용한다. 같은 시각의 이벤트는 flow_event_sequence로 순서를 구별한다. 준비→클릭→접수는 input_revision, 클릭→접수는 attempt도 일치해야 한다. 분모 0의 비율은 N/A다.
- 11은 구간 시작·종료 관측·종료 미관측을 함께 보여준다. 준비→클릭은 클릭 당시 재료의 준비 시각, 접수→결과는 같은 job의 첫 표시 시각이다. 05의 duration_ms는 prepare_image/prepare_upload/upload/submit 각각의 브라우저 경과 시간이며 캐시 재사용에 시간 0을 넣지 않는다.
- 경과 시간에는 비가시 탭 시간이 포함된다. flow_visible_ms는 탭이 보인 누적 시간이며 집중·이해·읽기 시간은 아니다. 홈 탐색 시간은 예시 감상·GIF 탐색 등을 포함한 경과이고 순수 GIF 탐색 시간으로 이름 붙이지 않는다. 사진 준비도 여러 선택·취소·대기를 포함한다.
- query fixture는 실행 전용 상수 테이블이다. 실제 events를 읽거나 가짜 이벤트를 삽입하지 않고 순서·분모·재료/attempt/job 연결·늦은 복귀·후속 종료를 실제 HogQL 엔진에서 검증한다.

## 이벤트 배치 점검 결과와 남은 관측 한계

- 기존 주요 시점은 맞다: 클릭은 실제 클릭, 접수는 job 발급 뒤, 완료/실패는 브라우저 상태 수신, 결과 표시는 이미지 로드+화면 교차+문서 visible 뒤, 평가/복사/링크 공유는 성공 응답 뒤다. photo_uploaded는 **브라우저 파일 선택**이며 서버 업로드 완료가 아니다. 실제 업로드는 composition_request_step.phase=upload를 본다.
- 이번 보강: flow_started_at·flow_event_sequence·measurement_contract_version=3, 재료 변경마다 input_revision, 준비 해제도 남기는 compose_input_state_changed, 재접수 previous_job_id. 기존 analytics_schema_version=2·이벤트 이름/속성·experience version은 보존한다.
- 입력 조합은 example/photo_example/scene_matches_example/is_example_pair/photo_source를 함께 해석한다. 예시 없음·속성 불일치는 네 가지 조합에 억지로 배정하지 않는다. 직접 파일은 본인 사진·좋아하는 대상이라는 의미를 증명하지 않는다.
- 섹션 노출은 있지만 설명의 개별 슬라이드/phase를 끝까지 읽었는지는 계측하지 않는다. 이해했다고 추정하거나 필수 전환 단계로 만들지 않는다. 검색어 원문·사진·파일명·설문 자유문을 추가 수집하지 않는다.
- 완료·실패와 처리 시간은 브라우저 관측이다. 서버 전체 상태·실패 사유·차감·환불·지불·최초 평가 저장값은 서버 기록이 기준이다. 미완료/미응답은 실패/불만족이 아니다.
- EXP-001 상세 설문은 유입 캠페인과 관계없이 합성 1회 이상 완료한 **계정 단위** 응답이다. 특정 job의 사용 맥락으로 자동 연결하지 않는다. 설문 즉시 1회 보상과 설문 완료자의 일일 3회 지급을 구분한다. `survey_reward_offer_viewed`, `daily_reward_menu_opened/offer_viewed/claim_clicked/claim_confirmed/claim_failed`, `pass_exhausted`를 추가 수집한다. 신규 지급은 서버의 `DAILY_REWARD` 거래와 lot를 기준으로 확인하고 실제 소비는 lot→차감 transaction→job으로 연결한다. 기존 보드는 이 서버 집계를 자동 포함하지 않으며 백엔드 `analytics/daily-rewards/report.sql`과 사용자별 관찰을 함께 사용한다.
- schema2·external에서 알려진 QA/source/localhost와 등록된 운영자 계정을 제외한다. external은 자연 이용 확정이 아니다. 운영자 계정은 POSTHOG_INTERNAL_ACCOUNT_IDS 쉼표 목록으로 제외할 수 있다. 지인·보상·운영 개입 여부는 별도 실행 근거와 대조해야 한다.
- 같은 job 결과 뒤 행동만 센다. 시각 동률에서 다른 flow의 선후가 확인되지 않으면 후속 행동으로 보태지 않는다. 재접수도 같은 flow의 발행 순서로 결과 전·후를 나누고, 다른 flow의 동률은 `동일 시각·순서 미상`으로 별도 표시한다. 재접수의 same_photo는 화면 File 참조 비교다. 탭 최초 결과부터의 since_first_result_ms를 특정 이전 job의 시간으로 쓰지 않는다.

## 검증

- `npm run test:unit`: 큐·계정 전환·origin·기존 입력/결과 행동 계약.
- `python3 -B -m unittest discover -s tests/posthog -v`: API 설정의 계획/재적용/중복 방지/무관한 연결 보존.
- `python3 -B scripts/validate_posthog_fixtures.py`: 개인 API 키가 있는 로컬에서 상수 데이터만으로 실제 HogQL 회귀 검증.
- `python3 -B scripts/setup_posthog.py --validate`: 실제 프로젝트에서 12개 분석 SQL 읽기 검증.
- `npx playwright test`: 기존 사용자 흐름의 mock 회귀. 테스트 SDK host는 loopback이며 실제 합성·운영 분석 송신을 하지 않는다.
- `posthog-transport.spec.ts`: 실제 SDK를 로컬 수신 mock에 연결해 payload·스키마·UTM·URL 민감값 제거를 검증한다.

SDK 설치 시 표시된 npm audit 결과는 기존 lockfile과 비교한다. 이 작업과 무관한 일괄 의존성 업그레이드는 하지 않는다.
