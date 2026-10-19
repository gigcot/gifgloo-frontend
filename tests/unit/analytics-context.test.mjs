import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function harness() {
  const events = [], timers = [];
  const window = {};
  const storage = new Map();
  let currentAttempt = 'attempt-A';
  const moduleCache = new Map();
  function load(name) {
    if (moduleCache.has(name)) return moduleCache.get(name);
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../../shared/lib/${name}.ts`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, window, console,
      sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      setTimeout: callback => { timers.push(callback); return 1; },
      require: dependency => dependency === './journey' ? { journeyContext: () => ({ flow_id: 'visit-flow', attempt_id: currentAttempt, experience_version: 'example-compose-v6' }) }
        : dependency === './campaign-attribution' ? { getCampaignAttribution: () => ({ utm_campaign: 'test' }) } : load(dependency.slice(2)),
    });
    moduleCache.set(name, exports);
    return exports;
  }
  return { events, timers, load,
    tracker: () => { window.umami = { track: (name, data) => events.push({ name, data }) }; },
    changeAttempt: () => { currentAttempt = 'attempt-B'; },
  };
}
test('queued events freeze visit and original-job context when emitted, with common schema and campaign', () => {
  const h = harness(); const origin = h.load('job-origin'); const analytics = h.load('umami');
  origin.setJobOriginOwner('owner');
  origin.rememberJobOrigin('job-A', 'owner', { flow_id: 'origin-flow', attempt_id: 'origin-attempt' });
  analytics.trackEvent('composition_completed', { job_id: 'job-A' });
  h.changeAttempt(); origin.setJobOriginOwner('other'); h.tracker(); h.timers.shift()();
  assert.equal(h.events[0].data.attempt_id, 'attempt-A');
  assert.equal(h.events[0].data.origin_attempt_id, 'origin-attempt');
  assert.equal(h.events[0].data.origin_linkage, 'known');
  assert.equal(h.events[0].data.analytics_schema_version, '2');
  assert.equal(h.events[0].data.experience_version, 'example-compose-v6');
  assert.equal(h.events[0].data.utm_campaign, 'test');
});
test('asset-only public result events never borrow the current attempt or an unrelated known job', () => {
  const h = harness(); h.tracker(); const origin = h.load('job-origin'); const analytics = h.load('umami');
  origin.setJobOriginOwner('owner');
  origin.rememberJobOrigin('private-job', 'owner', { flow_id: 'private', attempt_id: 'private-attempt' });
  for (const name of ['shared_result_viewed', 'shared_result_compose_clicked', 'result_downloaded', 'result_shared']) analytics.trackEvent(name, { source: 'shared_result' });
  for (const event of h.events) {
    assert.equal(event.data.origin_linkage, 'unknown');
    assert.equal(event.data.attempt_id, 'attempt-A');
    assert.equal(event.data.origin_attempt_id, undefined);
    assert.equal(event.data.origin_flow_id, undefined);
    assert.equal(event.data.job_id, undefined);
  }
});
