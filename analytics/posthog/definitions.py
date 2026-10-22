from copy import deepcopy
from datetime import datetime

MANAGED_TAG = 'gifgloo-observation-v1'
DATE_FILTER = {'dateRange': {'date_from': '-7d', 'date_to': None}}

BASE = '''WITH selected AS (
    SELECT uuid, event, timestamp, properties FROM events WHERE {filters}
), observed AS (
    SELECT event, timestamp, properties, uuid FROM events
    WHERE timestamp >= coalesce({filters.dateRange.from}, toDateTime(0)) AND timestamp <= __CUTOFF__
), scoped AS (
    SELECT *, nullIf(toString(properties.flow_id), '') AS flow_id,
      nullIf(toString(properties.job_id), '') AS job_id,
      nullIf(toString(properties.attempt_id), '') AS attempt_id,
      nullIf(toString(properties.input_revision), '') AS input_revision,
      tuple(timestamp, toIntOrZero(toString(properties.flow_event_sequence))) AS pos
    FROM observed
    WHERE toString(properties.analytics_schema_version) = '2'
      AND toString(properties.traffic_type) = 'external'
      AND NOT startsWith(coalesce(toString(properties.utm_campaign), ''), 'qa_')
      AND coalesce(toString(properties.utm_source), '') NOT IN ('qa', 'internal_qa', 'internal-qa')
      AND coalesce(toString(properties.utm_campaign), '') NOT IN ('internal_qa', 'onboarding_value_audit_20261019')
      AND NOT startsWith(coalesce(toString(properties.$host), ''), 'localhost')
      AND NOT startsWith(coalesce(toString(properties.$host), ''), '127.0.0.1')
      __ACCOUNT_FILTER__
)'''

COHORT = BASE + ''', traces AS (
    SELECT flow_id, arraySort(e -> e.1, groupArray(tuple(
      pos, event, coalesce(attempt_id, ''), coalesce(input_revision, ''), coalesce(job_id, ''),
      coalesce(toString(properties.gif_restored), ''),
      coalesce(toString(properties.photo_source), '미계측'), coalesce(toString(properties.example), '미계측'),
      coalesce(toString(properties.photo_example), '미계측'), coalesce(toString(properties.scene_matches_example), '미계측'),
      coalesce(toString(properties.is_example_pair), '미계측'),
      uuid IN (SELECT uuid FROM selected) AND toFloatOrZero(toString(properties.flow_started_at)) >= toUnixTimestamp(coalesce({filters.dateRange.from}, toDateTime(0))) * 1000,
      coalesce(toString(properties.flow_origin), '미계측'),
      coalesce(nullIf(toString(properties.utm_campaign), ''), '미상'),
      coalesce(nullIf(toString(properties.utm_content), ''), '미상'),
      coalesce(nullIf(toString(properties.$device_type), ''), '미계측'), uuid IN (SELECT uuid FROM selected)
    ))) AS trace FROM scoped WHERE flow_id IS NOT NULL GROUP BY flow_id
), entries AS (
    SELECT *, arrayFilter(e -> e.12 AND ((e.2 = 'home_viewed' AND e.13 = 'home')
      OR (e.2 = 'compose_viewed' AND e.13 = 'direct_compose')), trace) AS entry_events FROM traces
), arrivals AS (
    SELECT *, entry_events[1].1 AS entry_pos, entry_events[1].1.1 AS arrived_at,
      entry_events[1].13 AS route, entry_events[1].14 AS campaign, entry_events[1].15 AS content, entry_events[1].16 AS device
    FROM entries WHERE length(entry_events) > 0
), requests_in_flow AS (
    SELECT *, arrayFilter(e -> e.2 = 'composition_requested' AND e.1 > entry_pos AND e.5 != '', trace) AS request_events FROM arrivals
), intentions AS (
    SELECT *, arrayFilter(e -> e.2 = 'make_intent' AND e.1 > entry_pos
      AND (length(request_events) = 0 OR e.1 < request_events[1].1), trace) AS intent_events FROM requests_in_flow
), opened AS (
    SELECT *, arrayFilter(e -> e.2 = 'compose_viewed' AND e.6 IN ('true', '1')
      AND (length(request_events) = 0 OR e.1 < request_events[1].1)
      AND ((route = 'home' AND length(intent_events) > 0 AND e.1 > intent_events[1].1)
        OR (route = 'direct_compose' AND e.1 >= entry_pos)), trace) AS compose_events,
      length(arrayDistinct(arrayMap(e -> e.5, arrayFilter(e -> e.1 = request_events[1].1, request_events)))) AS same_position_jobs
    FROM intentions
), prepared AS (
    SELECT *, arrayFilter(e -> e.2 = 'compose_inputs_ready' AND e.4 != '' AND e.4 != 'unready'
      AND length(compose_events) > 0 AND e.1 > compose_events[1].1
      AND (length(request_events) = 0 OR e.1 < request_events[1].1), trace) AS ready_events
    FROM opened
), clicked AS (
    SELECT *, arrayFilter(e -> e.2 = 'compose_clicked' AND e.3 != ''
      AND (length(request_events) = 0 OR e.1 < request_events[1].1)
      AND arrayExists(r -> r.4 = e.4 AND r.1 < e.1, ready_events)
      AND (same_position_jobs != 1 OR (e.3 = request_events[1].3 AND e.4 = request_events[1].4 AND e.1 < request_events[1].1)), trace) AS click_events
    FROM prepared
), steps AS (
    SELECT *, length(intent_events) > 0 AS has_intent, intent_events[1].1 AS intent_pos,
      length(compose_events) > 0 AS has_compose, compose_events[1].1 AS compose_pos,
      length(ready_events) > 0 AS has_ready, ready_events[1].1 AS prepared_pos,
      length(click_events) > 0 AS has_click, click_events[1].1 AS click_pos,
      arrayFilter(r -> r.4 = click_events[1].4 AND r.1 < click_events[1].1, ready_events)[1].1 AS clicked_ready_pos,
      if(same_position_jobs = 1, request_events[1].5, '') AS first_job,
      request_events[1].1 AS request_pos, request_events[1].1.1 AS requested_at,
      request_events[1].7 AS photo_source, request_events[1].8 AS example, request_events[1].9 AS photo_example,
      request_events[1].10 AS scene_match, request_events[1].11 AS example_pair,
      (same_position_jobs = 1 AND length(click_events) > 0 AND request_events[1].3 = click_events[1].3
        AND request_events[1].4 = click_events[1].4 AND request_events[1].1 > click_events[1].1) AS has_request
    FROM clicked
), first_jobs AS (
    SELECT steps.flow_id AS request_flow, first_job AS job_id, requested_at, request_pos FROM steps WHERE first_job != ''
), views AS (
    SELECT scoped.job_id AS job_id, min(scoped.timestamp) AS viewed_at, groupArray(tuple(scoped.flow_id, scoped.pos)) AS view_positions FROM scoped
    WHERE event = 'composition_result_viewed' GROUP BY job_id HAVING job_id IS NOT NULL
), signals AS (
    SELECT first_jobs.job_id AS job_id,
      max(if(event = 'composition_completed', 1, 0)) AS completed_observed,
      max(if(event = 'composition_failed', 1, 0)) AS failed_observed,
      minIf(timestamp, event = 'composition_completed') AS completed_at,
      max(if(event = 'composition_result_viewed', 1, 0)) AS result_viewed,
      minIf(timestamp, event = 'composition_result_viewed') AS result_at,
      max(if(event = 'result_downloaded' AND nullIf(views.job_id, '') IS NOT NULL AND (timestamp > viewed_at OR arrayExists(v -> v.1 = scoped.flow_id AND v.2 < scoped.pos, view_positions)), 1, 0)) AS gif_save_started,
      max(if(event = 'result_export_download_attempted' AND nullIf(views.job_id, '') IS NOT NULL AND (timestamp > viewed_at OR arrayExists(v -> v.1 = scoped.flow_id AND v.2 < scoped.pos, view_positions)), 1, 0)) AS export_attempted,
      max(if(event = 'result_image_copied' AND nullIf(views.job_id, '') IS NOT NULL AND (timestamp > viewed_at OR arrayExists(v -> v.1 = scoped.flow_id AND v.2 < scoped.pos, view_positions)), 1, 0)) AS image_copied,
      max(if(event = 'result_shared' AND nullIf(views.job_id, '') IS NOT NULL AND (timestamp > viewed_at OR arrayExists(v -> v.1 = scoped.flow_id AND v.2 < scoped.pos, view_positions)), 1, 0)) AS link_copied,
      max(if(event = 'result_file_share_attempted' AND nullIf(views.job_id, '') IS NOT NULL AND (timestamp > viewed_at OR arrayExists(v -> v.1 = scoped.flow_id AND v.2 < scoped.pos, view_positions)), 1, 0)) AS file_share_attempted,
      max(if(event = 'result_file_share_resolved' AND nullIf(views.job_id, '') IS NOT NULL AND (timestamp > viewed_at OR arrayExists(v -> v.1 = scoped.flow_id AND v.2 < scoped.pos, view_positions)), 1, 0)) AS file_share_resolved
    FROM first_jobs JOIN scoped ON first_jobs.job_id = scoped.job_id
    LEFT JOIN views ON first_jobs.job_id = views.job_id
    WHERE scoped.timestamp > first_jobs.requested_at OR (scoped.flow_id = first_jobs.request_flow AND scoped.pos > first_jobs.request_pos) GROUP BY first_jobs.job_id
), funnel AS (
    SELECT steps.flow_id AS flow_id, route, campaign, content, device, entry_pos, arrived_at,
      has_intent, intent_pos, has_compose, compose_pos, has_ready, prepared_pos, has_click, click_pos, clicked_ready_pos,
      first_job, requested_at, request_pos, photo_source, example, photo_example, scene_match, example_pair, same_position_jobs, has_request,
      coalesce(signals.result_viewed, 0) AS result_viewed,
      signals.result_at AS result_at, signals.completed_at AS completed_at,
      coalesce(signals.completed_observed, 0) AS completed_observed, coalesce(signals.failed_observed, 0) AS failed_observed,
      coalesce(signals.gif_save_started, 0) AS gif_save_started, coalesce(signals.export_attempted, 0) AS export_attempted,
      coalesce(signals.image_copied, 0) AS image_copied, coalesce(signals.link_copied, 0) AS link_copied,
      coalesce(signals.file_share_attempted, 0) AS file_share_attempted, coalesce(signals.file_share_resolved, 0) AS file_share_resolved
    FROM steps LEFT JOIN signals ON steps.first_job = signals.job_id
)'''

COHORT_EVENTS = COHORT + ''', cohort_events AS (
    SELECT DISTINCT scoped.* FROM scoped JOIN (
      SELECT steps.flow_id AS cohort_flow, first_job FROM steps
    ) AS cohort ON scoped.flow_id = cohort.cohort_flow OR scoped.job_id = cohort.first_job
)'''

STAGES = [
    ('H 도착', 'true', 'true'),
    ('I 만들기 의도', "route = 'direct_compose' OR has_intent", 'true'),
    ('C GIF 복원된 합성 화면', 'has_compose', "route = 'direct_compose' OR has_intent"),
    ('P 입력 준비', 'has_ready', 'has_compose'),
    ('K 같은 재료로 합성 클릭', 'has_click', 'has_ready'),
    ('J 같은 attempt 접수', 'has_request', 'has_click'),
    ('R 같은 첫 job 결과 표시', 'has_request AND result_viewed = 1', 'has_request'),
]
FUNNEL_ROWS = """, stage_rows AS (
    SELECT route, arrayJoin([""" + ', '.join(
    f"tuple('{label}', {condition}, {denominator}, {order})" for order, (label, condition, denominator) in enumerate(STAGES)
) + """]) AS stage FROM funnel
) SELECT route AS `진입`, stage.1 AS `구간`, count() AS `도착 분모`, countIf(stage.2) AS `도달 flow`,
    countIf(stage.3) AS `이전 구간 분모`, round(100.0 * countIf(stage.2) / nullIf(countIf(stage.3), 0), 1) AS `이전 대비 백분율`
    FROM stage_rows WHERE route = 'home' OR stage.1 != 'I 만들기 의도' GROUP BY route, stage.1, stage.4
    ORDER BY route, stage.4"""

MATERIAL = '''multiIf(
    example IN ('none', '미계측', ''), concat('기준 예시 없음 / ', photo_source),
    photo_source = 'example' AND scene_match IN ('true', '1') AND photo_example = example AND example_pair IN ('true', '1'), '예시 GIF + 예시 사진',
    photo_source = 'upload' AND scene_match IN ('true', '1') AND example_pair IN ('false', '0'), '예시 GIF + 직접 파일',
    photo_source = 'example' AND scene_match IN ('false', '0'), '변경 GIF + 예시 사진',
    photo_source = 'upload' AND scene_match IN ('false', '0') AND example_pair IN ('false', '0'), '변경 GIF + 직접 파일',
    '미계측·속성 불일치')'''

SPECS = [
    ('first-value', '01 구간별 순차 퍼널 — 홈·직접 진입 분리',
     'H→I→C→P→K→J→R. 같은 flow, 시간·발행 순서, 준비/클릭/접수의 input_revision, 클릭/접수의 attempt를 확인합니다. 직접 진입은 I를 요구하지 않습니다. 설명 슬라이드 완독은 필수 단계가 아닙니다. 분모 0은 빈값(N/A). 사람 수가 아닌 탭 flow 수입니다.',
     COHORT + FUNNEL_ROWS),
    ('content-arrival', '02 유입·기기별 구간 비교 — 한 조건씩',
     '캠페인·콘텐츠와 기기를 별도 행으로 비교합니다. 탭 최초 UTM이며 공통 프로필 링크로 개별 영상 귀속을 단정하지 않습니다. external은 자연 이용 확정이 아닙니다. 소수 표본의 차이를 원인 효과로 해석하지 않습니다.',
     COHORT + ''', segments AS (SELECT route, has_ready, has_request, result_viewed, arrayJoin([tuple('콘텐츠', campaign, content), tuple('기기', device, '전체 콘텐츠')]) AS segment FROM funnel) SELECT segment.1 AS `비교 축`, segment.2 AS `조건 1`, segment.3 AS `조건 2`, route AS `진입`,
       count() AS `도착 flow`, countIf(has_ready) AS `준비 flow`, countIf(has_request) AS `순차 접수 flow`, countIf(has_request AND result_viewed = 1) AS `순차 결과 flow`
       FROM segments GROUP BY segment.1, segment.2, segment.3, route ORDER BY `비교 축`, `도착 flow` DESC'''),
    ('input-choice', '03 첫 접수 재료 — 예시·변경·직접 파일',
     '첫 접수의 example/photo_example/scene_matches_example/is_example_pair/photo_source를 함께 해석합니다. 기준 예시 없음·속성 불일치는 네 조합에 억지로 넣지 않습니다. 직접 파일은 본인 사진·의미 있는 대상의 증거가 아닙니다. 준비 중 선택·취소는 타임라인으로 확인합니다.',
     COHORT + f''' SELECT {MATERIAL} AS `재료 조합`, count() AS `첫 접수 job`, sum(result_viewed) AS `결과 표시 job`,
       sum(gif_save_started) AS `GIF 저장 시작 job`, sum(link_copied) AS `링크 복사 job`
       FROM funnel WHERE nullIf(first_job, '') IS NOT NULL GROUP BY `재료 조합` ORDER BY `첫 접수 job` DESC'''),
    ('job-readout', '04 흐름별 마지막 관측·열린 관찰 — 개별 진단',
     '가장 멀리 연결된 구간과 실제 결과 관측을 함께 보여 계측 단절을 드러냅니다. 관찰 나이가 짧은 흐름·미완료를 실패나 무가치로 판정하지 않습니다. 서버 완료 시각이 아닌 브라우저 관측입니다. 최근 도착 100개.',
     COHORT + ''', last_seen AS (
       SELECT funnel.flow_id AS flow_id, max(timestamp) AS last_at, argMax(event, tuple(timestamp, scoped.flow_id, pos)) AS last_event,
         max(if(scoped.flow_id = funnel.flow_id, toFloatOrZero(toString(properties.flow_visible_ms)), 0)) AS visible_ms
       FROM funnel JOIN scoped ON funnel.flow_id = scoped.flow_id OR funnel.first_job = scoped.job_id GROUP BY funnel.flow_id
       ) SELECT funnel.flow_id AS `flow`, route AS `진입`, first_job AS `첫 job`, arrived_at AS `도착`,
       multiIf(has_request AND result_viewed = 1, 'R 결과', has_request, 'J 접수', has_click, 'K 클릭', has_ready, 'P 준비', has_compose, 'C 합성 화면', has_intent, 'I 의도', 'H 도착') AS `연결된 마지막 구간`,
       result_viewed AS `실제 결과 관측`, completed_observed AS `완료 관측`, failed_observed AS `실패 관측`,
       last_event AS `마지막 관측 이벤트`, last_at AS `마지막 관측 시각`, round(visible_ms / 1000, 1) AS `탭 visible 누적 초`,
       dateDiff('second', arrived_at, __CUTOFF__) AS `도착 후 관찰 나이 초`, __CUTOFF__ AS `후속 관찰 추출 시각`
       FROM funnel JOIN last_seen ON funnel.flow_id = last_seen.flow_id ORDER BY arrived_at DESC LIMIT 100'''),
    ('execution-friction', '05 요청 단계별 실패·소요 시간 — attempt 진단',
     '단계 duration_ms는 브라우저의 해당 요청 경과 시간입니다. 캐시 재사용에는 시간 0을 채우지 않습니다. 확인 요청·취소·혼잡을 기술 실패로 합치지 않습니다. 같은 flow 코호트의 attempt/job이며 서버 전체 오류율은 아닙니다.',
     COHORT_EVENTS + ''' SELECT event AS `신호`, coalesce(toString(properties.phase), '미적용') AS `단계`,
       coalesce(toString(properties.status), toString(properties.action), '미적용') AS `상태·행동`,
       coalesce(toString(properties.http_status), '미적용') AS `HTTP`, count() AS `발생 횟수`,
       count(DISTINCT attempt_id) AS `고유 attempt`, count(DISTINCT job_id) AS `고유 job`,
       countIf(properties.duration_ms IS NOT NULL) AS `시간 표본 수`,
       round(avg(toFloatOrNull(toString(properties.duration_ms))), 0) AS `평균 ms`,
       quantile(0.5)(toFloatOrNull(toString(properties.duration_ms))) AS `중앙 ms`,
       quantile(0.9)(toFloatOrNull(toString(properties.duration_ms))) AS `p90 ms`
       FROM cohort_events WHERE event IN ('composition_request_step', 'anonymous_session_failed', 'compose_consent_save',
         'composition_frame_confirmation', 'composition_failed', 'composition_connection_lost',
         'composition_result_load_failed', 'result_export_load_failed', 'result_export_conversion_failed', 'result_file_share_failed')
       GROUP BY event, `단계`, `상태·행동`, `HTTP` ORDER BY `발생 횟수` DESC'''),
    ('feedback', '06 첫 결과의 최초 평가 — 미응답 별도',
     '첫 job의 결과 표시 뒤 최초 평가 이벤트입니다. 미응답≠불만족, 만족≠실제 활용입니다. 전체 최초 저장값은 서버 DB가 기준이며 잃어버린 응답 복구는 이벤트와 차이 날 수 있습니다. 계정 단위 EXP-001 설문을 특정 job 응답으로 배정하지 않습니다.',
     COHORT + ''', feedback AS (
       SELECT scoped.job_id AS job_id, argMin(toString(properties.satisfied), timestamp) AS satisfied
       FROM scoped JOIN views ON scoped.job_id = views.job_id
       WHERE event = 'composition_feedback_submitted' AND (timestamp > viewed_at OR arrayExists(v -> v.1 = scoped.flow_id AND v.2 < scoped.pos, view_positions)) GROUP BY scoped.job_id
       ) SELECT count() AS `첫 결과 표시 job`, countIf(nullIf(feedback.job_id, '') IS NOT NULL) AS `응답 관측 job`,
       countIf(satisfied IN ('true', '1')) AS `만족 job`, countIf(satisfied IN ('false', '0')) AS `아쉬움 job`,
       countIf(nullIf(feedback.job_id, '') IS NULL) AS `응답 미관측 job`
       FROM funnel LEFT JOIN feedback ON funnel.first_job = feedback.job_id WHERE result_viewed = 1'''),
    ('retry', '07 첫 작업 이후 재접수 — 이전 job 명시 연결',
     'previous_job_id로 코호트 첫 작업과 새 작업을 연결합니다. 파일 동일 여부는 화면의 File 참조 비교입니다. 첫 결과 뒤 재접수와 결과 전 재접수·실패 복구를 나누고, 다른 flow의 동일 시각은 순서 미상으로 남깁니다. 탭의 since_first_result_ms로 이전 job 경과 시간을 대신하지 않습니다. 새 목적의 재사용 여부는 이유·실제 활용 확인이 필요합니다.',
     COHORT + ''', retry_events AS (
       SELECT scoped.job_id AS retry_job, timestamp AS retried_at, result_at,
       coalesce(toString(properties.from_status), '미계측') AS from_status,
       coalesce(toString(properties.same_gif), '미상') AS same_gif, coalesce(toString(properties.same_photo), '미상') AS same_photo,
       multiIf(result_viewed = 0 OR timestamp < result_at, '첫 결과 관측 전',
         timestamp > result_at OR arrayExists(v -> v.2.1 = result_at AND v.1 = scoped.flow_id AND v.2 < scoped.pos, view_positions), '첫 결과 뒤',
         arrayAll(v -> v.2.1 != result_at OR (v.1 = scoped.flow_id AND v.2 > scoped.pos), view_positions), '첫 결과 관측 전',
         '동일 시각·순서 미상') AS result_order
       FROM scoped JOIN (SELECT flow_id AS request_flow, first_job, requested_at, request_pos, result_viewed, result_at FROM funnel) AS retry_origin
         ON toString(properties.previous_job_id) = retry_origin.first_job
       LEFT JOIN views ON retry_origin.first_job = views.job_id
       WHERE event = 'composition_retried' AND (timestamp > requested_at OR (scoped.flow_id = request_flow AND scoped.pos > request_pos))
       ) SELECT from_status AS `이전 상태`, same_gif AS `같은 GIF`, same_photo AS `같은 파일 참조`, result_order AS `결과와 순서`,
       count(DISTINCT retry_job) AS `재접수 job`,
       round(avg(if(result_order = '첫 결과 뒤', dateDiff('second', result_at, retried_at), NULL)), 1) AS `첫 결과부터 평균 초`
       FROM retry_events
       GROUP BY `이전 상태`, `같은 GIF`, `같은 파일 참조`, `결과와 순서` ORDER BY `재접수 job` DESC'''),
    ('measurement-quality', '08 계측 품질 — QA·구버전·연결 누락 포함',
     '이 타일만 선택한 날짜 안의 전체 이벤트를 검사합니다. 새 계약의 flow_started_at/발행 순서/input_revision과 재접수 previous_job_id 누락을 표시합니다. QA·운영자도 포함합니다. 운영자 계정 미등록이면 external에 포함될 수 있습니다.',
     BASE + ''' SELECT coalesce(toString(properties.traffic_type), '미계측') AS `traffic`,
       coalesce(toString(properties.measurement_contract_version), '구계약·미계측') AS `계약`,
       coalesce(nullIf(toString(properties.utm_campaign), ''), '미상') AS `campaign`, count() AS `발생 횟수`,
       countIf(properties.flow_started_at IS NULL OR properties.flow_event_sequence IS NULL) AS `흐름 시작·순서 누락`,
       countIf(event IN ('compose_inputs_ready', 'compose_clicked', 'composition_requested') AND properties.input_revision IS NULL) AS `재료 연결 누락`,
       countIf(event = 'composition_retried' AND properties.previous_job_id IS NULL) AS `이전 job 누락`,
       countIf(properties.job_id IS NOT NULL AND coalesce(toString(properties.origin_linkage), '') != 'known') AS `job origin 미확인`
       FROM selected WHERE event NOT IN ('$identify', '$set', '$set_once', '$web_vitals')
       GROUP BY `traffic`, `계약`, `campaign` ORDER BY `발생 횟수` DESC'''),
    ('unlinked-requests', '09 코호트 밖 접수·첫 작업 중복 — 누락 진단',
     '선택 날짜에 접수됐지만 새 도착 코호트와 연결되지 않은 요청, 최초 위치 동률의 여러 job을 분리합니다. 유지된 오래된 탭·결과 복귀·구계약·진입 누락을 임의로 유입 퍼널에 채우지 않습니다.',
     COHORT + ''', request_diagnostics AS (
       SELECT flow_id, entry_events,
         arrayFilter(e -> e.2 = 'composition_requested' AND (length(entry_events) = 0 OR e.1 > entry_events[1].1), trace) AS diag_requests,
         arrayFilter(e -> e.2 = 'composition_requested' AND e.17, trace) AS selected_requests
       FROM entries
       ), diagnosed_requests AS (
       SELECT flow_id, entry_events, arrayJoin(selected_requests) AS request_event,
         length(arrayDistinct(arrayMap(e -> e.5, arrayFilter(e -> e.1 = diag_requests[1].1, diag_requests)))) AS same_position_jobs
       FROM request_diagnostics
       ) SELECT flow_id AS `flow`, request_event.5 AS `job`, min(request_event.1.1) AS `접수 시각`,
       multiIf(length(entry_events) = 0, '새 도착 코호트 밖', request_event.1 <= entry_events[1].1, '도착 이전 요청', '첫 job 위치 동률') AS `진단`
       FROM diagnosed_requests WHERE length(entry_events) = 0 OR request_event.1 <= entry_events[1].1 OR same_position_jobs > 1
       GROUP BY flow_id, request_event.5, `진단` ORDER BY `접수 시각` DESC LIMIT 100'''),
    ('outcome-branches', '10 결과 뒤 행동 분기 — 저장·복사·공유 별도',
     '같은 첫 job의 결과 표시 뒤 각각 관측한 행동입니다. 서로 겹칠 수 있는 분기이며 저장→공유의 필수 퍼널이 아닙니다. GIF 저장 시작·파일 공유 API 응답은 기기 저장 완료·실제 대화 활용을 입증하지 않습니다.',
     COHORT + ''' SELECT countIf(nullIf(first_job, '') IS NOT NULL) AS `첫 접수 job`, sum(result_viewed) AS `결과 표시 분모`,
       sum(gif_save_started) AS `GIF 저장 시작`, sum(export_attempted) AS `PNG·MP4 저장 시도`, sum(image_copied) AS `이미지 복사`,
       sum(link_copied) AS `링크 복사`, sum(file_share_attempted) AS `파일 공유 시도`, sum(file_share_resolved) AS `파일 공유 API 응답`,
       countIf(result_viewed = 1 AND gif_save_started = 0 AND export_attempted = 0 AND image_copied = 0 AND link_copied = 0 AND file_share_attempted = 0) AS `위 행동 미관측 job`
       FROM funnel'''),
    ('stage-times', '11 구간별 시간·미완료 — 기다림과 준비 분리',
     '각 구간의 시작 분모·종료 관측·종료 미관측을 함께 봅니다. 경과 시간은 탭 비가시 시간을 포함하며 주의·실제 집중 시간이 아닙니다. 준비→클릭은 클릭한 재료 revision 기준입니다. 접수→완료는 브라우저 완료 관측 시간입니다. 미관측을 소요 0이나 이탈로 채우지 않습니다.',
     None),
    ('event-timeline', '12 개별 이벤트 순서 — flow·attempt·job 대조',
     '도착 코호트 flow의 이벤트와 첫 job의 다른 탭·날짜 복귀를 포함합니다. 동일 시각은 flow 발행 순서로 읽고, 다른 flow 간 동률은 순서 미상입니다. 원문 검색·사진·설문 자유문은 싣지 않습니다. 최신 500행이며 전체 건수 요약은 다른 타일을 봅니다.',
     COHORT_EVENTS + ''' SELECT timestamp AS `시각`, scoped.flow_id AS `현재 flow`, pos.2 AS `flow 발행 순서`,
       event AS `이벤트`, scoped.attempt_id AS `현재 attempt`, scoped.input_revision AS `재료 revision`, scoped.job_id AS `job`,
       toString(properties.origin_flow_id) AS `원래 flow`, toString(properties.origin_attempt_id) AS `원래 attempt`,
       toString(properties.previous_job_id) AS `이전 job`,
       concat('source=', coalesce(toString(properties.source), ''), '; section=', coalesce(toString(properties.section), ''),
         '; example=', coalesce(toString(properties.example), ''), '; photo=', coalesce(toString(properties.photo_source), ''),
         '; input_ready=', coalesce(toString(properties.input_ready), ''), '; gif_restored=', coalesce(toString(properties.gif_restored), '')) AS `선택·위치`,
       concat('reason=', coalesce(toString(properties.reason), ''), '; http=', coalesce(toString(properties.http_status), ''),
         '; satisfied=', coalesce(toString(properties.satisfied), '')) AS `진단·평가`, toString(properties.phase) AS `요청 단계`,
       coalesce(toString(properties.status), toString(properties.action)) AS `상태·행동`, toString(properties.duration_ms) AS `단계 ms`,
       toString(properties.flow_visible_ms) AS `탭 visible 누적 ms`
       FROM cohort_events AS scoped
       ORDER BY timestamp DESC, scoped.flow_id, pos.2 DESC LIMIT 500'''),
]

TIME_STAGES = [
    ('홈 탐색·예시·GIF 선택 → 만들기 의도', "route = 'home'", 'has_intent', 'entry_pos.1', 'intent_pos.1'),
    ('합성 화면 → 입력 준비', 'has_compose', 'has_ready', 'compose_pos.1', 'prepared_pos.1'),
    ('클릭한 재료 준비 → 클릭', 'has_ready', 'has_click', 'clicked_ready_pos.1', 'click_pos.1'),
    ('클릭 → 같은 attempt 접수', 'has_click', 'has_request', 'click_pos.1', 'requested_at'),
    ('접수 → 브라우저 완료 관측', "nullIf(first_job, '') IS NOT NULL", 'completed_observed = 1', 'requested_at', 'completed_at'),
    ('접수 → 첫 결과 표시', "nullIf(first_job, '') IS NOT NULL", 'result_viewed = 1', 'requested_at', 'result_at'),
    ('완료 관측 → 결과 표시', 'completed_observed = 1', 'result_viewed = 1 AND result_at >= completed_at', 'completed_at', 'result_at'),
]
TIME_ROWS = """, durations AS (SELECT arrayJoin([""" + ', '.join(
    f"tuple('{label}', {start}, ({start}) AND ({end}), if(({start}) AND ({end}), dateDiff('millisecond', {start_at}, {end_at}) / 1000.0, NULL))"
    for label, start, end, start_at, end_at in TIME_STAGES
) + """]) AS duration FROM funnel)
SELECT duration.1 AS `구간`, countIf(duration.2) AS `시작 flow·job`, countIf(duration.3) AS `종료 관측`,
    countIf(duration.2 AND NOT duration.3) AS `종료 미관측`, round(avg(duration.4), 1) AS `평균 초`, quantile(0.5)(duration.4) AS `중앙 초`
    FROM durations GROUP BY duration.1"""

SPECS = [(key, name, description, COHORT + TIME_ROWS if sql is None else sql) for key, name, description, sql in SPECS]


def build_definitions(internal_account_ids=(), observation_cutoff=None):
    account_filter = ''
    if internal_account_ids:
        if any(not account.replace('-', '').isalnum() for account in internal_account_ids):
            raise ValueError('Internal account IDs must be identifiers.')
        values = ', '.join("'" + account + "'" for account in internal_account_ids)
        account_filter = f"AND coalesce(toString(properties.account_id), '') NOT IN ({values})"
    cutoff = 'now()'
    if observation_cutoff:
        parsed = datetime.fromisoformat(observation_cutoff.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            raise ValueError('Observation cutoff must include a timezone.')
        cutoff = f"parseDateTimeBestEffort('{parsed.isoformat()}')"
    definitions = []
    for key, name, description, sql in SPECS:
        definitions.append({
            'key': key, 'name': name,
            'description': description + ' 날짜 필터는 새 flow 도착의 코호트 선택 범위(기본 최근 7일)입니다. 후속 행동은 별도 추출 시각까지 포함하며 현재는 ' + (observation_cutoff or '조회 시각까지 열린 관찰') + '입니다. 고정 후속 관찰창·실험 성공 기준은 미정입니다.',
            'tags': [MANAGED_TAG, f'{MANAGED_TAG}:{key}'],
            'query': {'kind': 'DataTableNode', 'source': {'kind': 'HogQLQuery',
                'query': sql.replace('__ACCOUNT_FILTER__', account_filter).replace('__CUTOFF__', cutoff),
                'filters': deepcopy(DATE_FILTER)}},
        })
    return definitions


DASHBOARD = {
    'name': 'Gifgloo — 가치 경험과 콘텐츠 관측',
    'description': '판정 질문: 의미 있는 대상을 원하는 GIF 장면에 넣어 표현·감상·소장할 가치를 느끼는 상황과 사용자가 있는가? 01 순차 구간에서 막힌 곳 → 02·03 유입/재료 조건 → 04·05·11·12 개별 흐름과 시간/오류 → 10 결과 뒤 행동 → 06 평가·07 재접수 단서 순으로 봅니다. H→I→C→P→K→J→R는 flow/재료/attempt/첫 job을 연결하며 사람 수가 아닙니다. 저장·공유는 선택 분기이고 실제 활용·의미·재사용 이유는 정성 근거와 대조합니다. 날짜는 새 도착 코호트, 후속은 추출 시각까지 열린 관찰입니다. 현재 프로젝트 날짜 기준 UTC(한국시간 +9시간)이며 실제 회차는 타임존을 포함한 시작·종료 시각으로 정합니다. 관찰 나이 차이·미완료를 이탈로 단정하지 않습니다. 08·09로 QA·구계약·연결 누락을 먼저 확인합니다. 운영자 계정 제외는 별도 등록 필요. PMF 합격선·회차·고정 후속 관찰창은 미정입니다.',
    'tags': [MANAGED_TAG], 'pinned': True,
}
