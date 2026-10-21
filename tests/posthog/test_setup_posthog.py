import copy
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('setup_posthog', ROOT / 'scripts/setup_posthog.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class FakeClient:
    host = 'https://us.posthog.com'
    project_id = '123'

    def __init__(self):
        self.data = {'dashboards/': [], 'insights/': []}
        self.writes = []
        self.queries = []
        self.query_result = {'results': [], 'query_status': None}

    def list_all(self, resource):
        return copy.deepcopy(self.data[resource])

    def request(self, method, path, data=None):
        if path == 'query/':
            self.queries.append(data)
            return copy.deepcopy(self.query_result)
        resource = path.split('/')[0] + '/'
        if method == 'POST':
            item = copy.deepcopy(data) | {'id': len(self.data[resource]) + 1}
            if resource == 'insights/':
                item['short_id'] = 'short-' + str(item['id'])
            self.data[resource].append(item)
            self.writes.append((method, path))
            return copy.deepcopy(item)
        item = next(item for item in self.data[resource] if item['id'] == int(path.split('/')[1]))
        if method == 'PATCH':
            item.update(copy.deepcopy(data))
            self.writes.append((method, path))
        result = copy.deepcopy(item)
        if resource == 'insights/':
            result['query']['source']['response'] = None
        return result


class SetupTests(unittest.TestCase):
    def test_plan_does_not_write_or_query_events(self):
        client = FakeClient()
        setup.provision(client, setup.definitions.build_definitions())
        self.assertEqual(client.writes, [])
        self.assertEqual(client.queries, [])

    def test_reapplying_updates_managed_resources_without_duplicates_or_unrelated_removal(self):
        client = FakeClient()
        desired = setup.definitions.build_definitions()
        (ROOT / '.posthog').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / '.posthog') as temp:
            setup.provision(client, desired, apply=True, backup_dir=Path(temp))
            client.data['dashboards/'][0]['tags'].append('user-dashboard-tag')
            client.data['insights/'][0]['tags'].append('user-tag')
            client.data['insights/'][0]['dashboards'].append(99)
            setup.provision(client, desired, apply=True, backup_dir=Path(temp))
            self.assertEqual(len(client.data['dashboards/']), 1)
            self.assertEqual(len(client.data['insights/']), len(desired))
            self.assertIn('user-tag', client.data['insights/'][0]['tags'])
            self.assertIn(99, client.data['insights/'][0]['dashboards'])
            self.assertIn('user-dashboard-tag', client.data['dashboards/'][0]['tags'])
            self.assertEqual(len(list(Path(temp).glob('before-*.json'))), 2)
            self.assertEqual(len(client.queries), 2 * len(desired))

    def test_duplicate_managed_tags_fail_instead_of_guessing(self):
        with self.assertRaises(RuntimeError):
            setup.find_managed([{'id': 1, 'tags': ['tag']}, {'id': 2, 'tags': ['tag']}], 'tag')
        client = FakeClient()
        tag = setup.definitions.build_definitions()[0]['tags'][1]
        client.data['insights/'] = [{'id': 1, 'tags': [tag]}, {'id': 2, 'tags': [tag]}]
        with self.assertRaises(RuntimeError):
            setup.provision(client, setup.definitions.build_definitions(), apply=True)
        self.assertEqual(client.writes, [])
        self.assertEqual(client.queries, [])

    def test_scope_excludes_internal_accounts_only_from_scoped_queries(self):
        desired = setup.definitions.build_definitions(('abc-123',))
        self.assertTrue(all("NOT IN ('abc-123')" in item['query']['source']['query'] for item in desired))
        quality = next(item for item in desired if item['key'] == 'measurement-quality')
        self.assertIn('FROM observed', quality['query']['source']['query'])
        with self.assertRaises(ValueError):
            setup.definitions.build_definitions(("x'); SELECT",))

    def test_unfinished_query_validation_prevents_resource_writes(self):
        client = FakeClient()
        client.query_result = {'query_status': {'complete': False}}
        with self.assertRaisesRegex(RuntimeError, 'did not finish'):
            setup.provision(client, setup.definitions.build_definitions(), apply=True)
        self.assertEqual(client.writes, [])


if __name__ == '__main__':
    unittest.main()
