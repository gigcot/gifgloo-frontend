#!/usr/bin/env python3
"""Run constants-only HogQL regressions without storing events."""
import importlib.util
from setup_posthog import Client, ROOT, definitions, load_env

spec = importlib.util.spec_from_file_location('posthog_fixtures', ROOT / 'tests/posthog/query_fixtures.py')
fixtures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixtures)


def validate(client):
    for name, sql, expected in fixtures.validation_cases(definitions):
        if 'FROM events' in sql:
            raise RuntimeError('Regression fixtures must not read production events.')
        result = client.request('POST', 'query/', {'query': {'kind': 'HogQLQuery', 'query': sql}, 'refresh': 'blocking'})
        if result.get('results') != expected:
            raise RuntimeError(f'HogQL fixture {name} differed from expected: {result.get("results")}')
        print(f'Passed constants-only HogQL fixture: {name}', flush=True)


if __name__ == '__main__':
    validate(Client(load_env(ROOT / '.env.posthog.local')))
