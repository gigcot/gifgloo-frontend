import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(storage) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../../shared/lib/journey.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Date, console, crypto: { randomUUID: () => 'new-flow' },
    document: { visibilityState: 'visible' }, window: { location: { pathname: '/', search: '' } }, process: { env: {} },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
  });
  return exports;
}
test('flow start and event sequence survive reload and upgrade of a stored journey', () => {
  const storage = new Map([['gifgloo_journey', JSON.stringify({ flow_id: 'existing-flow', origin: 'home', started_at: 123, visible_ms: 0 })]]);
  const first = load(storage);
  assert.equal(first.journeyContext().flow_started_at, 123);
  assert.equal(first.nextJourneyEventSequence(), 1);
  first.journeyContext();
  assert.equal(first.nextJourneyEventSequence(), 2);
  const reload = load(storage);
  assert.equal(reload.journeyContext().flow_id, 'existing-flow');
  assert.equal(reload.journeyContext().flow_started_at, 123);
  assert.equal(reload.nextJourneyEventSequence(), 3);
});
