"""Read-only SQL constants: never insert synthetic events into PostHog."""
import re
from datetime import datetime, timedelta, timezone

ENTRY_FROM = '2026-10-01 00:00:00'
ENTRY_TO = '2026-10-02 00:00:00'
CUTOFF = '2026-10-04 00:00:00'


def regression_query(definitions, select=None, cutoff=CUTOFF, extra_events=()):
    rows = []
    start = datetime(2026, 10, 1, tzinfo=timezone.utc)

    def add(flow, event, second, sequence, **props):
        properties = {
            'flow_id': flow, 'flow_origin': 'home', 'flow_started_at': str(int(start.timestamp() * 1000)),
            'flow_event_sequence': str(sequence), 'analytics_schema_version': '2', 'measurement_contract_version': '3',
            'traffic_type': 'external', '$host': 'gifgloo.com', **props,
        }
        instant = (start + timedelta(seconds=second)).strftime('%Y-%m-%d %H:%M:%S')
        rows.append((str(len(rows)), event, instant, properties))

    def home(flow, **props):
        add(flow, 'home_viewed', 0, 1, **props)
        add(flow, 'make_intent', 0, 2, **props)
        add(flow, 'compose_viewed', 0, 3, gif_restored='true', **props)

    def prepare(flow, revision, second=1):
        add(flow, 'compose_inputs_ready', second, 4, input_revision=revision)

    def request(flow, revision, job, attempt='a', second=3):
        add(flow, 'compose_clicked', second - 1, 5, input_revision=revision, attempt_id=attempt)
        add(flow, 'composition_requested', second, 6, input_revision=revision, attempt_id=attempt, job_id=job,
            photo_source='upload', example='face-online', photo_example='none', scene_matches_example='true', is_example_pair='false')

    home('complete')
    prepare('complete', 'r1')
    request('complete', 'r1', 'j1')
    add('complete', 'home_viewed', 20, 20)
    add('complete', 'composition_requested', 30, 30, job_id='j1', input_revision='r1', attempt_id='a')
    add('return-tab', 'composition_result_viewed', 90000, 1, job_id='j1', flow_origin='result_return')
    add('return-tab', 'result_downloaded', 90001, 2, job_id='j1', flow_origin='result_return')
    home('wrong-revision')
    prepare('wrong-revision', 'old')
    request('wrong-revision', 'new', 'j2')
    add('wrong-revision', 'composition_result_viewed', 8, 8, job_id='j2')
    home('wrong-job')
    prepare('wrong-job', 'r3')
    request('wrong-job', 'r3', 'j3')
    add('wrong-job', 'composition_requested', 6, 7, job_id='j-other', input_revision='r3', attempt_id='b')
    add('wrong-job', 'composition_result_viewed', 9, 9, job_id='j-other')
    add('direct', 'compose_viewed', 0, 1, flow_origin='direct_compose', gif_restored='true')
    prepare('direct', 'r4')
    request('direct', 'r4', 'j4')
    add('direct', 'composition_result_viewed', 8, 8, job_id='j4')
    add('reversed', 'home_viewed', 0, 1)
    add('reversed', 'compose_viewed', 1, 2, gif_restored='true')
    add('reversed', 'make_intent', 2, 3)
    prepare('reversed', 'r5', 3)
    request('reversed', 'r5', 'j5', second=5)
    home('before-view-only')
    prepare('before-view-only', 'r9')
    request('before-view-only', 'r9', 'j9')
    add('before-view-only', 'result_downloaded', 8, 7, job_id='j9')
    add('before-view-only', 'composition_result_viewed', 8, 8, job_id='j9')
    home('post-request-preparation')
    request('post-request-preparation', 'r10', 'j10')
    prepare('post-request-preparation', 'r10', 5)
    home('qa', utm_campaign='qa_regression')
    add('old-tab', 'home_viewed', 0, 1, flow_started_at='1')
    home('tie')
    prepare('tie', 'r6')
    request('tie', 'r6', 'j6')
    add('tie', 'composition_requested', 3, 6, input_revision='r6', attempt_id='a', job_id='j7')
    home('new-attempt')
    prepare('new-attempt', 'r7')
    request('new-attempt', 'r7', 'j8', attempt='old')
    # The first request must not join a different attempt's click.
    rows.pop()
    add('new-attempt', 'composition_requested', 3, 6, input_revision='r7', attempt_id='new', job_id='j8')
    for flow, event, second, sequence, properties in extra_events:
        add(flow, event, second, sequence, **properties)

    def literal(value):
        return "'" + value.replace("'", "''") + "'"

    selects = []
    for uuid, event, timestamp, properties in rows:
        entries = ["'__missing'", 'NULL']
        for key, value in properties.items():
            entries.extend((literal(key), literal(str(value))))
        selects.append(f"SELECT {literal(uuid)} AS uuid, {literal(event)} AS event, toDateTime({literal(timestamp)}) AS timestamp, map({', '.join(entries)}) AS properties")
    sql = definitions.COHORT + (select or ''' SELECT flow_id, has_intent, has_compose, has_ready, has_click, has_request,
        result_viewed, gif_save_started, first_job, same_position_jobs FROM funnel ORDER BY flow_id''')
    sql = sql.replace('WITH selected AS', 'WITH fixture AS (' + ' UNION ALL '.join(selects) + '), selected AS', 1)
    sql = sql.replace('FROM events', 'FROM fixture')
    sql = sql.replace('{filters.dateRange.from}', f"toDateTime('{ENTRY_FROM}')").replace('{filters.dateRange.to}', f"toDateTime('{ENTRY_TO}')")
    sql = sql.replace('{filters}', f"timestamp >= toDateTime('{ENTRY_FROM}') AND timestamp < toDateTime('{ENTRY_TO}')")
    sql = sql.replace('__CUTOFF__', f"toDateTime('{cutoff}')").replace('__ACCOUNT_FILTER__', '')
    return re.sub(r'properties\.([\w$]+)', lambda m: "arrayElement(properties, '" + m[1] + "')", sql)


EXPECTED = [
    ['before-view-only', 1, 1, 1, 1, 1, 1, 0, 'j9', 1],
    ['complete', 1, 1, 1, 1, 1, 1, 1, 'j1', 1],
    ['direct', 0, 1, 1, 1, 1, 1, 0, 'j4', 1],
    ['new-attempt', 1, 1, 1, 0, 0, 0, 0, 'j8', 1],
    ['post-request-preparation', 1, 1, 0, 0, 0, 0, 0, 'j10', 1],
    ['reversed', 1, 0, 0, 0, 0, 0, 0, 'j5', 1],
    ['tie', 1, 1, 1, 1, 0, 0, 0, '', 2],
    ['wrong-job', 1, 1, 1, 1, 1, 0, 0, 'j3', 1],
    ['wrong-revision', 1, 1, 1, 0, 0, 1, 0, 'j2', 1],
]


def validation_cases(definitions):
    earlier = [row[:] for row in EXPECTED]
    earlier[1][6:8] = [0, 0]
    material_rows = [
        "SELECT '01' AS case_id, 'face-online' AS example, 'example' AS photo_source, 'face-online' AS photo_example, 'true' AS scene_match, 'true' AS example_pair",
        "SELECT '02', 'face-online', 'upload', 'none', 'true', 'false'",
        "SELECT '03', 'face-online', 'example', 'face-online', 'false', 'false'",
        "SELECT '04', 'face-online', 'upload', 'none', 'false', 'false'",
        "SELECT '05', 'none', 'upload', 'none', 'false', 'false'",
        "SELECT '06', 'face-online', 'example', 'other', 'true', 'false'",
    ]
    material_sql = 'WITH cases AS (' + ' UNION ALL '.join(material_rows) + ') SELECT case_id, ' + definitions.MATERIAL + ' FROM cases ORDER BY case_id'
    retry_sql = next(sql for key, _, _, sql in definitions.SPECS if key == 'retry')
    retry_detail = retry_sql[len(definitions.COHORT):].split(') SELECT from_status AS')[0] + ') SELECT retry_job, result_order FROM retry_events ORDER BY retry_job'
    retry_events = [
        ('before-view-only', 'composition_retried', 8, 7, {'job_id': 'retry-before', 'previous_job_id': 'j9'}),
        ('before-view-only', 'composition_retried', 8, 9, {'job_id': 'retry-after', 'previous_job_id': 'j9'}),
        ('other-retry-tab', 'composition_retried', 8, 1, {'job_id': 'retry-unknown', 'previous_job_id': 'j9', 'flow_origin': 'result_return'}),
        ('other-retry-tab', 'composition_retried', 9, 2, {'job_id': 'retry-later', 'previous_job_id': 'j9', 'flow_origin': 'result_return'}),
    ]
    return observation_cases(definitions) + [
        ('material-four-choices-and-unknowns', material_sql, [
            ['01', '예시 GIF + 예시 사진'], ['02', '예시 GIF + 직접 파일'],
            ['03', '변경 GIF + 예시 사진'], ['04', '변경 GIF + 직접 파일'],
            ['05', '기준 예시 없음 / upload'], ['06', '미계측·속성 불일치'],
        ]),
        ('flow-attempt-job-order', regression_query(definitions), EXPECTED),
        ('funnel-display-order', regression_query(definitions, definitions.FUNNEL_ROWS), [
            ['direct_compose', label, 1, 1, 1, 100] for label, _, _ in definitions.STAGES if not label.startswith('I ')
        ] + [
            ['home', 'H 도착', 8, 8, 8, 100], ['home', 'I 만들기 의도', 8, 8, 8, 100],
            ['home', 'C GIF 복원된 합성 화면', 8, 7, 8, 87.5], ['home', 'P 입력 준비', 8, 6, 7, 85.7],
            ['home', 'K 같은 재료로 합성 클릭', 8, 4, 6, 66.7], ['home', 'J 같은 attempt 접수', 8, 3, 4, 75],
            ['home', 'R 같은 첫 job 결과 표시', 8, 2, 3, 66.7],
        ]),
        ('retry-result-order', regression_query(definitions, retry_detail, extra_events=retry_events), [
            ['retry-after', '첫 결과 뒤'], ['retry-before', '첫 결과 관측 전'],
            ['retry-later', '첫 결과 뒤'], ['retry-unknown', '동일 시각·순서 미상'],
        ]),
        ('fixed-followup-cutoff', regression_query(definitions, cutoff='2026-10-02 00:00:00'), earlier),
        ('material-unknown', regression_query(definitions,
            ' SELECT ' + definitions.MATERIAL + ' AS material, count() FROM funnel WHERE first_job != \'\' GROUP BY material ORDER BY material'),
            [['기준 예시 없음 / 미계측', 1], ['예시 GIF + 직접 파일', 7]]),
        ('stage-time-and-unfinished', regression_query(definitions,
            " SELECT flow_id, dateDiff('second', clicked_ready_pos.1, click_pos.1), dateDiff('second', click_pos.1, requested_at), if(result_viewed = 1, dateDiff('second', requested_at, result_at), NULL) FROM funnel WHERE has_request ORDER BY flow_id"),
            [['before-view-only', 1, 1, 5], ['complete', 1, 1, 89997], ['direct', 1, 1, 5], ['wrong-job', 1, 1, None]]),
    ]


def observation_cases(definitions):
    def query(sql, events, cutoff=CUTOFF):
        rows = []
        for index, (event, second, props) in enumerate(events):
            properties = {'analytics_schema_version': '2', 'traffic_type': 'external', '$host': 'gifgloo.com',
                          'flow_id': 'old-tab', 'flow_event_sequence': str(index), **props}
            def literal(value):
                return "'" + str(value).replace("'", "''") + "'"
            entries = ["'__missing'", 'NULL']
            for key, value in properties.items():
                entries.extend((literal(key), literal(value)))
            rows.append(f"SELECT '{index}' AS uuid, {literal(event)} AS event, toDateTime('{ENTRY_FROM}') + interval {second} second AS timestamp, map({', '.join(entries)}) AS properties")
        sql = sql.replace('WITH selected AS', 'WITH fixture AS (' + ' UNION ALL '.join(rows) + '), selected AS', 1)
        sql = sql.replace('FROM events', 'FROM fixture')
        sql = sql.replace('{filters.dateRange.from}', f"toDateTime('{ENTRY_FROM}')")
        sql = sql.replace('{filters}', f"timestamp >= toDateTime('{ENTRY_FROM}') AND timestamp < toDateTime('{ENTRY_TO}')")
        sql = sql.replace('__CUTOFF__', f"toDateTime('{cutoff}')")
        sql = sql.replace('__ACCOUNT_FILTER__', "AND coalesce(toString(properties.account_id), '') != 'operator'")
        return re.sub(r'((?:\w+\.)?properties)\.([\w$]+)', lambda m: "arrayElement(" + m[1] + ", '" + m[2] + "')", sql)

    job_events = [
        ('composition_requested', 1, {'job_id': 'a-failed', 'account_id': 'a'}),
        ('composition_failed', 2, {'job_id': 'a-failed', 'account_id': 'a'}),
        ('composition_requested', 3, {'job_id': 'b-success', 'account_id': 'a'}),
        ('composition_requested', 4, {'job_id': 'b-success', 'account_id': 'a'}),
        ('composition_retried', 4, {'job_id': 'b-success', 'account_id': 'a', 'from_status': 'failed'}),
        ('result_downloaded', 5, {'job_id': 'b-success', 'account_id': 'a'}),
        ('composition_completed', 5, {'job_id': 'b-success', 'account_id': 'a'}),
        ('composition_result_viewed', 5, {'job_id': 'b-success', 'account_id': 'a'}),
        ('result_downloaded', 5, {'job_id': 'b-success', 'account_id': 'a'}),
        ('result_downloaded', 6, {'job_id': 'b-success', 'account_id': 'a'}),
        ('result_file_share_attempted', 7, {'job_id': 'b-success', 'account_id': 'a'}),
        ('result_file_share_resolved', 90000, {'job_id': 'b-success', 'account_id': 'a', 'flow_id': 'return-tab'}),
        ('composition_requested', 60000, {'job_id': 'c-next-day', 'account_id': 'a', 'flow_id': 'new-tab'}),
        ('composition_requested', 60001, {'job_id': 'd-unknown'}),
        ('composition_requested', 10, {'job_id': 'qa', 'account_id': 'a', 'utm_campaign': 'qa_fixture'}),
        ('composition_requested', 10, {'job_id': 'operator-job', 'account_id': 'operator'}),
        ('composition_requested', 90001, {'job_id': 'outside-period', 'account_id': 'a'}),
    ]
    reward_events = [
        ('composition_requested', 99, {'account_id': 'a', 'job_id': 'before'}),
        ('daily_reward_claim_confirmed', 100, {'account_id': 'a', 'granted': 'true', 'claim_date': '2026-10-01'}),
        ('daily_reward_claim_confirmed', 101, {'account_id': 'a', 'granted': 'false', 'claim_date': '2026-10-01'}),
        ('daily_reward_claim_confirmed', 102, {'account_id': 'a', 'granted': 'true', 'claim_date': '2026-10-01'}),
        ('daily_reward_claim_confirmed', 103, {'account_id': 'b', 'granted': 'false', 'claim_date': '2026-10-01'}),
        ('composition_requested', 104, {'account_id': 'a', 'job_id': 'after'}),
        ('composition_requested', 105, {'account_id': 'a', 'job_id': 'after'}),
        ('daily_reward_claim_confirmed', 90000, {'account_id': 'a', 'granted': 'true', 'claim_date': '2026-10-02'}),
        ('composition_requested', 90001, {'account_id': 'a', 'job_id': 'after-next-day'}),
    ]
    return [
        ('all-jobs-later-success-dedup-return-qa', query(definitions.ALL_JOBS +
          ' SELECT job_id, completed, failed, viewed, saved, share_attempted, share_resolved FROM all_jobs ORDER BY job_id', job_events),
         [['a-failed', 0, 1, 0, 0, 0, 0], ['b-success', 1, 0, 1, 1, 1, 1], ['c-next-day', 0, 0, 0, 0, 0, 0], ['d-unknown', 0, 0, 0, 0, 0, 0]]),
        ('repeat-account-result-failure-and-day', query(next(sql for key, _, _, sql in definitions.SPECS if key == 'repeat-jobs'), job_events),
         [[4, 1, 1, 2, 1, 1, 1, 1, 1]]),
        ('reward-dedup-new-grant-followup-jobs', query(definitions.REWARD +
          ' SELECT account_id, claim_days, requested_jobs, request_days, followup_claim_days FROM reward_followup ORDER BY account_id', reward_events),
         [['a', 1, 2, 2, 2]]),
        ('reward-followup-cutoff', query(definitions.REWARD +
          ' SELECT account_id, claim_days, requested_jobs, request_days, followup_claim_days FROM reward_followup ORDER BY account_id', reward_events, ENTRY_TO),
         [['a', 1, 1, 1, 1]]),
        ('payment-account-dedup-test-and-unknown', query(next(sql for key, _, _, sql in definitions.SPECS if key == 'payment-observation'), [
            ('payment_checkout_started', 1, {'account_id': 'a'}),
            ('payment_checkout_started', 2, {'account_id': 'a'}),
            ('payment_completed', 3, {'account_id': 'a', 'test_payment': 'true'}),
            ('payment_completed', 4, {'account_id': 'b', 'test_payment': 'false'}),
            ('payment_failed', 5, {'stage': 'checkout'}),
            ('payment_completed', 6, {'account_id': 'operator', 'test_payment': 'false'}),
        ]), [['payment_checkout_started', '미적용', '미계측', 2, 1, 0],
             ['payment_completed', '미적용', 'false', 1, 1, 0],
             ['payment_completed', '미적용', 'true', 1, 1, 0],
             ['payment_failed', 'checkout', '미계측', 1, 0, 1]]),
    ]
