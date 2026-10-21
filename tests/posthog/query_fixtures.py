"""Read-only SQL constants: never insert synthetic events into PostHog."""
import re
from datetime import datetime, timedelta, timezone

ENTRY_FROM = '2026-10-01 00:00:00'
ENTRY_TO = '2026-10-02 00:00:00'
CUTOFF = '2026-10-04 00:00:00'


def regression_query(definitions, select=None, cutoff=CUTOFF):
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
    return [
        ('material-four-choices-and-unknowns', material_sql, [
            ['01', '예시 GIF + 예시 사진'], ['02', '예시 GIF + 직접 파일'],
            ['03', '변경 GIF + 예시 사진'], ['04', '변경 GIF + 직접 파일'],
            ['05', '기준 예시 없음 / upload'], ['06', '미계측·속성 불일치'],
        ]),
        ('flow-attempt-job-order', regression_query(definitions), EXPECTED),
        ('fixed-followup-cutoff', regression_query(definitions, cutoff='2026-10-02 00:00:00'), earlier),
        ('material-unknown', regression_query(definitions,
            ' SELECT ' + definitions.MATERIAL + ' AS material, count() FROM funnel WHERE first_job != \'\' GROUP BY material ORDER BY material'),
            [['기준 예시 없음 / 미계측', 1], ['예시 GIF + 직접 파일', 7]]),
        ('stage-time-and-unfinished', regression_query(definitions,
            " SELECT flow_id, dateDiff('second', clicked_ready_pos.1, click_pos.1), dateDiff('second', click_pos.1, requested_at), if(result_viewed = 1, dateDiff('second', requested_at, result_at), NULL) FROM funnel WHERE has_request ORDER BY flow_id"),
            [['before-view-only', 1, 1, 5], ['complete', 1, 1, 89997], ['direct', 1, 1, 5], ['wrong-job', 1, 1, None]]),
    ]
