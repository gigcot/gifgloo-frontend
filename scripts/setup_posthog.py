#!/usr/bin/env python3
import argparse
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('posthog_definitions', ROOT / 'analytics/posthog/definitions.py')
definitions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(definitions)


def load_env(path):
    values = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values | {key: value for key, value in os.environ.items() if key.startswith(('POSTHOG_', 'NEXT_PUBLIC_POSTHOG_'))}


class Client:
    def __init__(self, env):
        self.host = env['POSTHOG_APP_HOST'].rstrip('/')
        self.project_id = env['POSTHOG_PROJECT_ID']
        self.key = env['POSTHOG_PERSONAL_API_KEY']
        if self.host not in ('https://us.posthog.com', 'https://eu.posthog.com') or not self.project_id.isdigit() or not self.key:
            raise ValueError('Set the official app host, numeric project ID and personal API key in the ignored environment file.')
        self.base = f'{self.host}/api/projects/{self.project_id}/'

    def request(self, method, path, data=None):
        url = path if path.startswith('https://') else self.base + path
        if not url.startswith(self.base):
            raise ValueError('Refusing to send credentials outside the selected project API.')
        body = json.dumps(data).encode() if data is not None else None
        request = Request(url, data=body, method=method, headers={
            'Authorization': f'Bearer {self.key}', 'Content-Type': 'application/json', 'Accept': 'application/json',
        })
        try:
            with urlopen(request, timeout=60) as response:
                return json.load(response)
        except HTTPError as error:
            detail = error.read().decode()[:1200].replace(self.key, '[redacted]')
            raise RuntimeError(f'PostHog {method} {urlparse(url).path}: HTTP {error.code}: {detail}') from None

    def list_all(self, resource):
        result, path = [], resource + '?limit=100'
        while path:
            page = self.request('GET', path)
            result.extend(page['results'])
            path = page['next']
        return result


def find_managed(resources, tag):
    matches = [item for item in resources if tag in item['tags'] and not item.get('deleted', False)]
    if len(matches) > 1:
        raise RuntimeError(f'Multiple resources have managed tag {tag}; resolve the duplicate before applying.')
    return matches[0] if matches else None


def provision(client, desired, apply=False, validate=False, backup_dir=ROOT / '.posthog'):
    dashboards = client.list_all('dashboards/')
    insights = client.list_all('insights/')
    dashboard = find_managed(dashboards, definitions.MANAGED_TAG)
    current_insights = {item['key']: find_managed(insights, item['tags'][1]) for item in desired}
    if validate or apply:
        for item in desired:
            result = client.request('POST', 'query/', {'query': item['query']['source'], 'refresh': 'blocking'})
            status = result.get('query_status')
            if result.get('error') or (status and status.get('error')):
                raise RuntimeError(f'Query validation failed for {item["key"]}.')
            if result.get('results') is None:
                raise RuntimeError(f'Query validation did not finish for {item["key"]}; retry before applying.')
            print(f'Validated query: {item["key"]}', flush=True)
        print(f'Validated {len(desired)} read-only queries.')
    if not apply:
        print(json.dumps({'mode': 'plan', 'dashboard': dashboard['id'] if dashboard else 'create',
            'insights': [{'key': item['key'], 'action': 'update' if current_insights[item['key']] else 'create'} for item in desired]}, ensure_ascii=False, indent=2))
        return None
    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    backup_dir.chmod(0o700)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = backup_dir / f'before-{stamp}.json'
    backup.write_text(json.dumps({'dashboards': dashboards, 'insights': insights}, ensure_ascii=False, indent=2))
    backup.chmod(0o600)
    if dashboard:
        payload = definitions.DASHBOARD | {'tags': list(dict.fromkeys(dashboard['tags'] + definitions.DASHBOARD['tags']))}
        dashboard = client.request('PATCH', f'dashboards/{dashboard["id"]}/', payload)
    else:
        dashboard = client.request('POST', 'dashboards/', definitions.DASHBOARD)
    applied = []
    for order, item in enumerate(desired):
        current = current_insights[item['key']]
        targets = sorted(set((current['dashboards'] if current else []) + [dashboard['id']]))
        payload = {key: item[key] for key in ('name', 'description', 'query', 'tags')}
        payload.update({'dashboards': targets, 'order': order})
        if current:
            merged_tags = list(dict.fromkeys(current['tags'] + payload['tags']))
            payload['tags'] = merged_tags
            saved = client.request('PATCH', f'insights/{current["id"]}/', payload)
        else:
            saved = client.request('POST', 'insights/', payload)
        verified = client.request('GET', f'insights/{saved["id"]}/')
        if (verified['name'] != item['name'] or verified['description'] != item['description']
                or not includes_definition(verified['query'], item['query'])
                or not set(payload['tags']).issubset(verified['tags']) or dashboard['id'] not in verified['dashboards']):
            raise RuntimeError(f'Saved insight verification failed for {item["key"]}.')
        applied.append({'key': item['key'], 'id': saved['id'], 'short_id': saved['short_id']})
    verified = client.request('GET', f'dashboards/{dashboard["id"]}/')
    if (verified['name'] != definitions.DASHBOARD['name'] or verified['description'] != definitions.DASHBOARD['description']
            or definitions.MANAGED_TAG not in verified['tags'] or verified['pinned'] is not True):
        raise RuntimeError('Saved dashboard verification failed.')
    state = {'dashboard_id': dashboard['id'], 'insights': applied, 'applied_at': datetime.now(timezone.utc).isoformat()}
    state_path = backup_dir / 'state.json'
    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2))
    state_path.chmod(0o600)
    print(json.dumps({'dashboard_url': f'{client.host}/project/{client.project_id}/dashboard/{dashboard["id"]}', 'verified_insights': len(applied), 'backup': str(backup.relative_to(ROOT))}, ensure_ascii=False))
    return state


def includes_definition(actual, expected):
    if isinstance(expected, dict):
        return isinstance(actual, dict) and all(key in actual and includes_definition(actual[key], value) for key, value in expected.items())
    return actual == expected


def prepare_runtime(env, project):
    host = env['POSTHOG_APP_HOST'].replace('https://us.', 'https://us.i.').replace('https://eu.', 'https://eu.i.')
    values = {'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN': project['api_token'], 'NEXT_PUBLIC_POSTHOG_HOST': host}
    path = ROOT / '.env.local'
    lines = path.read_text().splitlines() if path.exists() else []
    lines = [line for line in lines if line.partition('=')[0] not in values]
    path.write_text('\n'.join(lines + [f'{key}={value}' for key, value in values.items()]) + '\n')
    path.chmod(0o600)
    print('Updated only the two public PostHog runtime variables in ignored .env.local.')


def main():
    parser = argparse.ArgumentParser(description='Plan, validate and idempotently apply Gifgloo PostHog analytics.')
    parser.add_argument('--env-file', type=Path, default=ROOT / '.env.posthog.local')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--validate', action='store_true')
    parser.add_argument('--prepare-runtime', action='store_true')
    parser.add_argument('--print-definitions', action='store_true')
    args = parser.parse_args()
    env = load_env(args.env_file)
    desired = definitions.build_definitions(
        tuple(filter(None, env.get('POSTHOG_INTERNAL_ACCOUNT_IDS', '').split(','))),
        env.get('POSTHOG_OBSERVATION_CUTOFF'),
    )
    if args.print_definitions:
        print(json.dumps({'dashboard': definitions.DASHBOARD, 'insights': desired}, ensure_ascii=False, indent=2))
        return
    client = Client(env)
    project = client.request('GET', '')
    print(json.dumps({'project_id': project['id'], 'project_name': project['name']}, ensure_ascii=False))
    if args.prepare_runtime:
        prepare_runtime(env, project)
    provision(client, desired, args.apply, args.validate)


if __name__ == '__main__':
    main()
