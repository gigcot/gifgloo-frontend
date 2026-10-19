import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(storage = new Map(), failStorage = false) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../../shared/lib/job-origin.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, DOMException, console: failStorage ? { warn() {} } : console, sessionStorage: {
    getItem: key => { if (failStorage) throw new DOMException('blocked', 'SecurityError'); return storage.get(key) ?? null; },
    setItem: (key, value) => { if (failStorage) throw new DOMException('full', 'QuotaExceededError'); storage.set(key, value); },
    removeItem: key => { if (failStorage) throw new DOMException('blocked', 'SecurityError'); storage.delete(key); },
  } });
  return { ...exports, storage };
}
const plain = value => JSON.parse(JSON.stringify(value));
test('A → B → A and reload preserve immutable accepted origins', () => {
  const api = load();
  api.setJobOriginOwner('owner');
  api.rememberJobOrigin('A', 'owner', { flow_id: 'flow-A', attempt_id: 'attempt-A' });
  api.rememberJobOrigin('B', 'owner', { flow_id: 'flow-B', attempt_id: 'attempt-B' });
  api.rememberJobOrigin('A', 'owner', { flow_id: 'flow-B', attempt_id: 'attempt-B' });
  assert.deepEqual(plain(api.jobOriginContext('A')), { origin_linkage: 'known', origin_flow_id: 'flow-A', origin_attempt_id: 'attempt-A' });
  assert.equal(api.jobOriginContext('B').origin_attempt_id, 'attempt-B');
  const reload = load(api.storage);
  assert.deepEqual(plain(reload.jobOriginContext('A')), { origin_linkage: 'unknown' });
  reload.setJobOriginOwner('owner');
  assert.equal(reload.jobOriginContext('A').origin_attempt_id, 'attempt-A');
});
test('missing storage, public asset-only results and missing attempt never infer origin', () => {
  const api = load(); api.setJobOriginOwner('owner');
  api.rememberJobOrigin('no-attempt', 'owner', { flow_id: 'current' });
  for (const id of [undefined, 'other-tab-job', 'no-attempt']) assert.deepEqual(plain(api.jobOriginContext(id)), { origin_linkage: 'unknown' });
});
test('owner changes and logout clear old mappings, including late accepted responses', () => {
  const api = load(); api.setJobOriginOwner('one');
  api.rememberJobOrigin('private', 'one', { flow_id: 'flow', attempt_id: 'attempt' });
  api.setJobOriginOwner('two');
  api.rememberJobOrigin('late', 'one', { flow_id: 'flow', attempt_id: 'attempt' });
  assert.equal(api.storage.size, 0);
  api.setJobOriginOwner('one');
  assert.equal(api.jobOriginContext('private').origin_linkage, 'unknown');
  api.rememberJobOrigin('new', 'one', { flow_id: 'flow', attempt_id: 'attempt' });
  api.setJobOriginOwner(null);
  assert.equal(api.storage.size, 0);
});
test('FIFO bounds retained origins to 50 without refreshing old jobs', () => {
  const api = load(); api.setJobOriginOwner('owner');
  for (let index = 0; index < 51; index++) api.rememberJobOrigin(`job-${index}`, 'owner', { flow_id: `flow-${index}`, attempt_id: `attempt-${index}` });
  assert.equal(api.jobOriginContext('job-0').origin_linkage, 'unknown');
  assert.equal(api.jobOriginContext('job-1').origin_linkage, 'known');
  assert.equal(JSON.parse([...api.storage.values()][0]).jobs.length, 50);
});
test('corrupt storage remains unknown', () => {
  const api = load(new Map([['gifgloo_job_origins', JSON.stringify({ ownerId: 'owner', jobs: [{}] })]]));
  api.setJobOriginOwner('owner');
  assert.equal(api.jobOriginContext('job').origin_linkage, 'unknown');
});

test('SecurityError reads and QuotaExceededError writes never break tracking or fabricate origin', () => {
  const api = load(new Map(), true);
  assert.doesNotThrow(() => api.setJobOriginOwner('owner'));
  assert.doesNotThrow(() => api.rememberJobOrigin('job', 'owner', { flow_id: 'flow', attempt_id: 'attempt' }));
  assert.equal(api.jobOriginContext('job').origin_linkage, 'unknown');
  assert.doesNotThrow(() => api.setJobOriginOwner(null));
});
