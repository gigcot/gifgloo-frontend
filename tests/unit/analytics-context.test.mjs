import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function harness() {
  const events = [], identities = [], resets = [];
  const window = {};
  const storage = new Map();
  let currentAttempt = 'attempt-A';
  let sequence = 0;
  let distinctId = 'device';
  let identified;
  const moduleCache = new Map();
  function load(name) {
    if (moduleCache.has(name)) return moduleCache.get(name);
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(`../../shared/lib/${name}.ts`, import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, window, console, Date,
      sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
      require: dependency => dependency === './journey' ? { journeyContext: () => ({ flow_id: 'visit-flow', attempt_id: currentAttempt, experience_version: 'example-compose-v6' }), nextJourneyEventSequence: () => ++sequence }
        : dependency === './campaign-attribution' ? { getCampaignAttribution: () => ({ utm_campaign: 'test' }) } : load(dependency.slice(2)),
    });
    moduleCache.set(name, exports);
    return exports;
  }
  return { events, identities, resets, load,
    tracker: () => load('analytics').setAnalyticsClient({
      capture: (name, data, options) => events.push({ name, data, options }),
      identify: id => { identities.push(id); distinctId = id; identified = id; },
      reset: resetDevice => { resets.push(resetDevice); distinctId = `device-${resets.length}`; identified = undefined; },
      get_distinct_id: () => distinctId,
      get_property: () => identified,
    }),
    changeAttempt: () => { currentAttempt = 'attempt-B'; },
  };
}
test('queued events freeze job, visit, account and occurrence time before the SDK is ready', () => {
  const h = harness(); const origin = h.load('job-origin'); const analytics = h.load('analytics');
  origin.setJobOriginOwner('owner'); analytics.identifyUser('owner');
  origin.rememberJobOrigin('job-A', 'owner', { flow_id: 'origin-flow', attempt_id: 'origin-attempt' });
  const before = Date.now(); analytics.trackEvent('composition_completed', { job_id: 'job-A' }); const after = Date.now();
  h.changeAttempt(); origin.setJobOriginOwner('other'); analytics.identifyUser('other'); h.tracker();
  assert.equal(h.events[0].data.attempt_id, 'attempt-A');
  assert.equal(h.events[0].data.origin_attempt_id, 'origin-attempt');
  assert.equal(h.events[0].data.origin_linkage, 'known');
  assert.equal(h.events[0].data.analytics_schema_version, '2');
  assert.equal(h.events[0].data.experience_version, 'example-compose-v6');
  assert.equal(h.events[0].data.utm_campaign, 'test');
  assert.equal(h.events[0].data.distinct_id, 'owner');
  assert.equal(h.events[0].data.account_id, 'owner');
  assert.ok(h.events[0].options.timestamp.getTime() >= before && h.events[0].options.timestamp.getTime() <= after);
});
test('authentication resolution precedes anonymous capture, and account changes reset SDK identity', () => {
  const h = harness(); h.tracker(); const analytics = h.load('analytics');
  analytics.trackEvent('home_viewed'); assert.equal(h.events.length, 0);
  analytics.identifyUser(null); assert.equal(h.events[0].data.distinct_id, 'device');
  analytics.identifyUser('A'); analytics.trackEvent('composition_requested', { job_id: 'A-job' });
  analytics.identifyUser('B'); analytics.trackEvent('composition_requested', { job_id: 'B-job' });
  analytics.identifyUser(null); analytics.trackEvent('home_viewed');
  assert.deepEqual(h.identities, ['A', 'B']); assert.deepEqual(h.resets, [true, true]);
  assert.deepEqual(h.events.map(e => e.data.distinct_id), ['device', 'A', 'B', 'device-2']);
  assert.equal(h.events.at(-1).data.account_id, undefined);
});
test('asset-only public results keep linkage unknown; once suppression remains local to the runtime', () => {
  const h = harness(); h.tracker(); const origin = h.load('job-origin'); const analytics = h.load('analytics');
  analytics.identifyUser('owner'); origin.setJobOriginOwner('owner');
  origin.rememberJobOrigin('private-job', 'owner', { flow_id: 'private', attempt_id: 'private-attempt' });
  for (const name of ['shared_result_viewed', 'shared_result_compose_clicked', 'result_downloaded', 'result_shared']) analytics.trackEvent(name, { source: 'shared_result' });
  for (const event of h.events) {
    assert.equal(event.data.origin_linkage, 'unknown'); assert.equal(event.data.attempt_id, 'attempt-A');
    assert.equal(event.data.origin_attempt_id, undefined); assert.equal(event.data.origin_flow_id, undefined); assert.equal(event.data.job_id, undefined);
  }
  analytics.trackEventOnce('first', 'home_viewed'); analytics.trackEventOnce('first', 'home_viewed');
  assert.equal(h.events.filter(e => e.name === 'home_viewed').length, 1);
});
