from copy import deepcopy

MANAGED_TAG = 'gifgloo-observation-v1'
DATE_FILTER = {'dateRange': {'date_from': '-7d', 'date_to': None}}

BASE = '''WITH observed AS (
    SELECT event, timestamp, properties FROM events WHERE {filters}
), scoped AS (
    SELECT * FROM observed
    WHERE toString(properties.analytics_schema_version) = '2'
      AND toString(properties.traffic_type) = 'external'
      AND NOT startsWith(coalesce(toString(properties.utm_campaign), ''), 'qa_')
      AND coalesce(toString(properties.utm_source), '') NOT IN ('qa', 'internal_qa', 'internal-qa')
      AND coalesce(toString(properties.utm_campaign), '') NOT IN ('internal_qa', 'onboarding_value_audit_20261019')
      AND NOT startsWith(coalesce(toString(properties.$host), ''), 'localhost')
      AND NOT startsWith(coalesce(toString(properties.$host), ''), '127.0.0.1')
      __ACCOUNT_FILTER__
)'''

COHORT = BASE + ''', arrivals AS (
    SELECT nullIf(toString(properties.flow_id), '') AS flow_id,
           min(timestamp) AS arrived_at,
           argMin(coalesce(nullIf(toString(properties.utm_campaign), ''), '미상'), timestamp) AS campaign,
           argMin(coalesce(nullIf(toString(properties.utm_content), ''), '미상'), timestamp) AS content,
           argMin(coalesce(nullIf(toString(properties.flow_origin), ''), '미상'), timestamp) AS route
    FROM scoped
    WHERE event = 'home_viewed' OR (event = 'compose_viewed' AND toString(properties.flow_origin) = 'direct_compose')
    GROUP BY flow_id HAVING flow_id IS NOT NULL
), requests AS (
    SELECT nullIf(toString(properties.flow_id), '') AS flow_id,
           nullIf(toString(properties.job_id), '') AS job_id,
           min(timestamp) AS requested_at,
           argMin(coalesce(toString(properties.photo_source), '미계측'), timestamp) AS photo_source,
           argMin(coalesce(toString(properties.is_example_pair), '미계측'), timestamp) AS example_pair
    FROM scoped WHERE event = 'composition_requested'
    GROUP BY flow_id, job_id HAVING flow_id IS NOT NULL AND job_id IS NOT NULL
), first_request_times AS (
    SELECT requests.flow_id AS flow_id, min(requested_at) AS requested_at
    FROM requests JOIN arrivals ON requests.flow_id = arrivals.flow_id
    WHERE requests.requested_at >= arrivals.arrived_at GROUP BY requests.flow_id
), first_job_choices AS (
    SELECT requests.flow_id AS flow_id, min(requests.job_id) AS job_id,
           min(requests.requested_at) AS requested_at, min(photo_source) AS photo_source,
           min(example_pair) AS example_pair, count() AS same_time_jobs
    FROM requests JOIN first_request_times ON requests.flow_id = first_request_times.flow_id
      AND requests.requested_at = first_request_times.requested_at
    GROUP BY requests.flow_id
), first_jobs AS (
    SELECT * FROM first_job_choices WHERE same_time_jobs = 1
), preparation AS (
    SELECT arrivals.flow_id AS flow_id,
           max(if(event = 'compose_viewed', 1, 0)) AS compose_opened,
           max(if(event = 'compose_inputs_ready', 1, 0)) AS inputs_ready,
           max(if(event = 'compose_clicked', 1, 0)) AS compose_clicked
    FROM arrivals JOIN scoped ON arrivals.flow_id = toString(scoped.properties.flow_id)
    LEFT JOIN first_request_times ON arrivals.flow_id = first_request_times.flow_id
    WHERE timestamp >= arrived_at AND (nullIf(first_request_times.flow_id, '') IS NULL OR timestamp <= first_request_times.requested_at)
    GROUP BY arrivals.flow_id
), views AS (
    SELECT nullIf(toString(properties.job_id), '') AS job_id, min(timestamp) AS viewed_at
    FROM scoped WHERE event = 'composition_result_viewed' GROUP BY job_id HAVING job_id IS NOT NULL
), signals AS (
    SELECT first_jobs.job_id AS job_id,
           max(if(event = 'composition_completed', 1, 0)) AS completed_observed,
           max(if(event = 'composition_failed', 1, 0)) AS failed_observed,
           max(if(event = 'composition_result_viewed', 1, 0)) AS result_viewed,
           max(if(event = 'result_downloaded' AND nullIf(views.job_id, '') IS NOT NULL AND timestamp >= viewed_at, 1, 0)) AS gif_save_started,
           max(if(event = 'result_export_download_attempted' AND nullIf(views.job_id, '') IS NOT NULL AND timestamp >= viewed_at, 1, 0)) AS export_attempted,
           max(if(event = 'result_image_copied' AND nullIf(views.job_id, '') IS NOT NULL AND timestamp >= viewed_at, 1, 0)) AS image_copied,
           max(if(event = 'result_shared' AND nullIf(views.job_id, '') IS NOT NULL AND timestamp >= viewed_at, 1, 0)) AS link_copied,
           max(if(event = 'result_file_share_attempted' AND nullIf(views.job_id, '') IS NOT NULL AND timestamp >= viewed_at, 1, 0)) AS file_share_attempted,
           max(if(event = 'result_file_share_resolved' AND nullIf(views.job_id, '') IS NOT NULL AND timestamp >= viewed_at, 1, 0)) AS file_share_resolved
    FROM first_jobs JOIN scoped ON first_jobs.job_id = toString(scoped.properties.job_id)
    LEFT JOIN views ON first_jobs.job_id = views.job_id
    WHERE timestamp >= requested_at GROUP BY first_jobs.job_id
)'''

SPECS = [
    ('first-value', '01 첫 결과와 후속 행동 — 고유 flow·첫 job',
     '외부 표기·알려진 QA 제외 흐름. 준비 단계는 첫 접수 이전의 각 신호 관측 수이며 순차 퍼널이 아닙니다. 첫 접수 시각에 여러 job이면 선택 불명확으로 분리합니다. 같은 첫 job의 결과 표시 뒤 행동만 연결합니다. 저장·복사·공유는 실제 활용의 입증이 아닙니다.',
     COHORT + ''' SELECT count() AS `도착 flow`,
       sum(coalesce(compose_opened, 0)) AS `합성 화면 관측 flow`,
       sum(coalesce(inputs_ready, 0)) AS `입력 준비 관측 flow`,
       sum(coalesce(compose_clicked, 0)) AS `합성 클릭 관측 flow`,
       countIf(nullIf(first_jobs.job_id, '') IS NOT NULL) AS `첫 job 확정 접수 flow`,
       countIf(first_job_choices.same_time_jobs > 1) AS `첫 job 선택 불명확 flow`,
       sum(coalesce(result_viewed, 0)) AS `첫 결과 표시 job`,
       sum(coalesce(gif_save_started, 0)) AS `GIF 저장 시작 job`,
       sum(coalesce(export_attempted, 0)) AS `PNG·MP4 저장 시도 job`,
       sum(coalesce(image_copied, 0)) AS `이미지 복사 job`,
       sum(coalesce(link_copied, 0)) AS `링크 복사 job`,
       sum(coalesce(file_share_attempted, 0)) AS `파일 공유 시도 job`,
       sum(coalesce(file_share_resolved, 0)) AS `파일 공유 API 응답 job`
       FROM arrivals LEFT JOIN first_jobs ON arrivals.flow_id = first_jobs.flow_id
       LEFT JOIN signals ON first_jobs.job_id = signals.job_id
       LEFT JOIN preparation ON arrivals.flow_id = preparation.flow_id
       LEFT JOIN first_job_choices ON arrivals.flow_id = first_job_choices.flow_id'''),
    ('content-arrival', '02 콘텐츠 귀속과 첫 결과 — 고유 flow',
     '탭 최초 UTM 귀속입니다. 공통 프로필 링크는 영상별 귀속을 입증하지 않습니다. 미상은 미상으로 유지하고 플랫폼 조회·클릭을 사이트 도착으로 대체하지 않습니다.',
     COHORT + ''' SELECT campaign AS `캠페인`, content AS `콘텐츠`, route AS `진입 경로`, count() AS `도착 flow`,
       countIf(nullIf(first_jobs.job_id, '') IS NOT NULL) AS `첫 접수 flow`, sum(coalesce(result_viewed, 0)) AS `첫 결과 표시 job`
       FROM arrivals LEFT JOIN first_jobs ON arrivals.flow_id = first_jobs.flow_id
       LEFT JOIN signals ON first_jobs.job_id = signals.job_id GROUP BY campaign, content, route ORDER BY `도착 flow` DESC'''),
    ('input-choice', '03 첫 접수의 재료 선택 — 의미는 별도 관찰',
     '제품 예시 재현·직접 파일·미계측을 구분합니다. 직접 파일이 본인 사진 또는 개인적 의미를, 예시 변경이 사용자 가치를 증명하지는 않습니다.',
     COHORT + ''' SELECT photo_source AS `사진 선택 경로`, example_pair AS `예시 조합 그대로`,
       count() AS `첫 접수 job`, sum(coalesce(result_viewed, 0)) AS `결과 표시 job`
       FROM first_jobs LEFT JOIN signals ON first_jobs.job_id = signals.job_id
       GROUP BY photo_source, example_pair ORDER BY `첫 접수 job` DESC'''),
    ('job-readout', '04 작업별 결과 연결 — 브라우저 관측',
     '같은 job을 연결합니다. 완료·실패는 브라우저가 관측한 상태이며 서버 전체 상태가 아닙니다. 결과 표시 없음은 진행 중·복귀 전·수집 누락일 수 있어 이탈로 확정하지 않습니다.',
     COHORT + ''' SELECT first_jobs.flow_id AS `flow`, first_jobs.job_id AS `job`, requested_at AS `첫 접수 시각`,
       coalesce(completed_observed, 0) AS `완료 관측`, coalesce(failed_observed, 0) AS `실패 관측`,
       coalesce(result_viewed, 0) AS `결과 표시`, coalesce(gif_save_started, 0) AS `GIF 저장 시작`,
       coalesce(link_copied, 0) AS `링크 복사`
       FROM first_jobs LEFT JOIN signals ON first_jobs.job_id = signals.job_id ORDER BY requested_at DESC LIMIT 100'''),
    ('execution-friction', '05 실행·대기·복귀의 장애물 — 진단',
     '이벤트 횟수와 고유 attempt/job을 구분합니다. 서버 실패 원인·차감·환불은 서버 기록으로 대조합니다. 취소·확인·혼잡과 기술 오류를 합치지 않습니다.',
     BASE + ''' SELECT event AS `신호`, coalesce(toString(properties.phase), '미적용') AS `단계`,
       coalesce(toString(properties.status), '미적용') AS `상태`,
       coalesce(toString(properties.http_status), '미적용') AS `HTTP`, count() AS `발생 횟수`,
       count(DISTINCT nullIf(toString(properties.attempt_id), '')) AS `고유 attempt`,
       count(DISTINCT nullIf(toString(properties.job_id), '')) AS `고유 job`
       FROM scoped WHERE event IN ('composition_request_step', 'anonymous_session_failed', 'compose_consent_save',
         'composition_frame_confirmation', 'composition_failed', 'composition_connection_lost',
         'composition_result_load_failed', 'result_export_load_failed', 'result_export_conversion_failed', 'result_file_share_failed')
       GROUP BY event, `단계`, `상태`, `HTTP` ORDER BY `발생 횟수` DESC'''),
    ('feedback', '06 결과별 최초 평가 — 응답과 미응답 구분',
     '같은 기간 내 표시 job과 최초 평가 이벤트를 연결한 응답 신호입니다. 미응답≠불만족, 만족≠실제 활용입니다. 평가의 전체 최초 저장 수·값은 서버 DB가 기준입니다.',
     BASE + ''', shown AS (
       SELECT nullIf(toString(properties.job_id), '') AS job_id FROM scoped
       WHERE event = 'composition_result_viewed' GROUP BY job_id HAVING job_id IS NOT NULL
       ), feedback AS (
       SELECT nullIf(toString(properties.job_id), '') AS job_id,
         argMin(toString(properties.satisfied), timestamp) AS satisfied
       FROM scoped WHERE event = 'composition_feedback_submitted' GROUP BY job_id HAVING job_id IS NOT NULL
       ) SELECT count() AS `표시 job`, countIf(nullIf(feedback.job_id, '') IS NOT NULL) AS `응답 관측 job`,
       countIf(satisfied IN ('true', '1')) AS `만족 응답 job`,
       countIf(satisfied IN ('false', '0')) AS `아쉬움 응답 job`
       FROM shown LEFT JOIN feedback ON shown.job_id = feedback.job_id'''),
    ('retry', '07 재접수 단서 — 새 목적 재사용은 미확인',
     '같은 화면에서 기록된 재접수만 포함하며 모든 재사용의 분모가 아닙니다. 이전 성공/실패·동일 재료는 단서이고 재미·품질 수리·새 목적의 이유는 설명과 실제 행동으로 구분합니다.',
     BASE + ''' SELECT coalesce(toString(properties.from_status), '미계측') AS `이전 상태`,
       coalesce(toString(properties.same_gif), '미계측') AS `같은 GIF`,
       coalesce(toString(properties.same_photo), '미계측') AS `같은 파일 참조`,
       coalesce(toString(properties.survey_state), '미계측') AS `설문 상태`,
       count(DISTINCT nullIf(toString(properties.job_id), '')) AS `재접수 job`
       FROM scoped WHERE event = 'composition_retried'
       GROUP BY `이전 상태`, `같은 GIF`, `같은 파일 참조`, `설문 상태` ORDER BY `재접수 job` DESC'''),
    ('measurement-quality', '08 QA·출처·버전·연결 품질 — 전체 포함',
     '이 보기에는 QA·운영자·미계측을 포함합니다. external은 자연 이용 확정이 아닙니다. job 없는 이벤트는 origin linkage 미적용이고, 과거 필드 부재와 unknown을 구분합니다.',
     BASE + ''' SELECT coalesce(toString(properties.traffic_type), '미계측') AS `traffic`,
       coalesce(toString(properties.analytics_schema_version), '미계측') AS `schema`,
       coalesce(nullIf(toString(properties.utm_campaign), ''), '미상') AS `campaign`,
       if(nullIf(toString(properties.job_id), '') IS NULL, '미적용', coalesce(toString(properties.origin_linkage), '미계측')) AS `origin 연결`,
       count() AS `발생 횟수`, count(DISTINCT nullIf(toString(properties.flow_id), '')) AS `고유 flow`
       FROM observed WHERE event NOT IN ('$identify', '$set', '$set_once')
       GROUP BY `traffic`, `schema`, `campaign`, `origin 연결` ORDER BY `발생 횟수` DESC'''),
    ('unlinked-requests', '09 도착과 연결되지 않은 접수 — 누락 진단',
     '기간 내 도착 신호가 없는 접수를 별도 보존합니다. 장기 유지 탭·다른 진입·차단·누락 등 여러 설명이 가능하므로 유입 퍼널에 임의로 채워 넣지 않습니다.',
     COHORT + ''' SELECT requests.flow_id AS `flow`, requests.job_id AS `job`, requests.requested_at AS `접수 시각`
       FROM requests LEFT JOIN arrivals ON requests.flow_id = arrivals.flow_id
       WHERE nullIf(arrivals.flow_id, '') IS NULL ORDER BY requests.requested_at DESC LIMIT 100'''),
]


def build_definitions(internal_account_ids=()):
    account_filter = ''
    if internal_account_ids:
        if any(not account.replace('-', '').isalnum() for account in internal_account_ids):
            raise ValueError('Internal account IDs must be identifiers.')
        values = ', '.join("'" + account + "'" for account in internal_account_ids)
        account_filter = f"AND coalesce(toString(properties.account_id), '') NOT IN ({values})"
    definitions = []
    for key, name, description, sql in SPECS:
        definitions.append({
            'key': key,
            'name': name,
            'description': description + ' 기본 조회는 최근 7일이며 실험 기간·후속 관찰창·성공 기준의 확정이 아닙니다. 기간 밖 후속 행동은 이 조회에 포함하지 않습니다.',
            'tags': [MANAGED_TAG, f'{MANAGED_TAG}:{key}'],
            'query': {'kind': 'DataTableNode', 'source': {
                'kind': 'HogQLQuery', 'query': sql.replace('__ACCOUNT_FILTER__', account_filter),
                'filters': deepcopy(DATE_FILTER),
            }},
        })
    return definitions


DASHBOARD = {
    'name': 'Gifgloo — 가치 경험과 콘텐츠 관측',
    'description': '의미 있는 대상을 원하는 장면에 넣어 표현·감상·소장할 가치가 있는지 확인하기 위한 행동 근거입니다. 같은 flow의 첫 job을 연결하며 사람·계정·탭 흐름·작업은 다릅니다. 알려진 QA를 제외한 외부 표기 관측이며 자연 사용자 확정이 아닙니다. 운영자 계정 제외는 별도 등록이 필요합니다. 저장·복사·공유 시도는 실제 활용이 아니고 새 목적 재사용·지불 가치도 별도 질문입니다. 결과 없는 흐름을 이탈로 단정하지 않습니다. 기본 최근 7일은 보기 범위이며 회차 기간·후속 관찰 종료·PMF 합격선은 미정입니다. 서버 상태·실제 지불·개인적 의미는 서버/정성 근거와 대조합니다.',
    'tags': [MANAGED_TAG],
    'pinned': True,
}
