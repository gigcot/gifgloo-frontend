import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
const project = fileURLToPath(new URL('../../', import.meta.url));
const projectRequire = createRequire(import.meta.url);
const ts = projectRequire('typescript');
const componentPath = path.join(project, 'features/compositions/ui/ResultMedia.tsx');
const source = fs.readFileSync(componentPath, 'utf8');
const ast = ts.createSourceFile(componentPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const owned = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'OwnedResultMedia');
assert(owned, 'OwnedResultMedia must exist; adapt harness if the component was intentionally renamed');
const stateNames = [];
function findState(node) {
  if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(ast) === 'useState') stateNames.push(node.name.elements[0].getText(ast));
  ts.forEachChild(node, findState);
}
findState(owned);
const delays = [120,160,120,120,120,160,120,120,120,160,120,120,120,160,120,120,120,160,120,40];
const cycle = delays.reduce((total, delay) => total + delay, 0);
const fakeGif = { width: 480, height: 480, previewWidth: 480, previewHeight: 480, frames: delays.map(delay => ({ delay, png: new Blob(), bitmap: {}, thumbnailUrl: 'blob:test' })) };
const transpile = (text, fileName) => ts.transpileModule(text, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const flatten = (element, output = []) => {
  if (element && typeof element === 'object') {
    output.push(element);
    const children = element.props?.children;
    (Array.isArray(children) ? children : [children]).flat().forEach(child => flatten(child, output));
  }
  return output;
};
function createHarness(seed = {}) {
  const states = [], refs = [], transitions = [], events = [];
  let stateCursor = 0, refCursor = 0, effects = [], now = 0, raf = null, encodingCalls = 0;
  const authFetch = () => { throw new Error('Unexpected network call: review harness must stay offline'); };
  const react = {
    useState(initial) {
      const index = stateCursor++;
      const name = stateNames[index];
      if (!(index in states)) states[index] = Object.hasOwn(seed, name) ? seed[name] : typeof initial === 'function' ? initial() : initial;
      return [states[index], value => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
        if (name === 'frameIndex') transitions.push({ index: states[index], time: now });
      }];
    },
    useRef(initial) { const index = refCursor++; return refs[index] ??= { current: initial }; },
    useEffect(fn, deps) { effects.push({ fn, deps }); },
    useId: () => 'review-id',
    useMemo: fn => fn(),
    useCallback: fn => fn,
  };
  const moduleCache = new Map();
  const globals = {
    AbortController, Error, Blob, File, TextDecoder, Uint8ClampedArray,
    navigator: { clipboard: { write: async () => {} }, share: async () => {}, canShare: () => true },
    ClipboardItem: class { constructor(data) { this.data = data; } },
    window: { matchMedia: () => ({ matches: false }) },
    performance: { now: () => now },
    requestAnimationFrame: callback => { raf = callback; return 1; },
    cancelAnimationFrame: () => { raf = null; },
    setTimeout, clearTimeout,
  };
  function loadModule(filename) {
    if (moduleCache.has(filename)) return moduleCache.get(filename);
    const exports = {};
    moduleCache.set(filename, exports);
    const text = fs.readFileSync(filename, 'utf8') + (filename === componentPath ? '\nexports.__reviewOwned = OwnedResultMedia;\n' : '');
    const sandbox = { ...globals, exports, require: name => resolveImport(name, filename) };
    vm.runInNewContext(transpile(text, filename), sandbox, { filename });
    return sandbox.exports;
  }
  function resolveImport(name, from) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return projectRequire(name);
    if (name === 'lucide-react') return new Proxy({}, { get: (_, name) => String(name) });
    if (name.endsWith('.css')) return new Proxy({}, { get: (_, name) => String(name) });
    if (name === '@/shared/lib/use-auth') return { useAuth: () => ({ authFetch, userId: 'review-user' }) };
    if (name === '@/shared/lib/api-base') return { API_BASE: 'https://offline.invalid' };
    if (name === '@/shared/lib/umami') return { trackEvent: (name, data) => events.push({ name, data }), trackEventOnce: (_, name, data) => events.push({ name, data }) };
    if (name === '@/shared/lib/journey') return { recordFirstResult() {} };
    if (name === '@/shared/lib/download') return { downloadGif() {} };
    if (name === '@/shared/ui/ShareButton') return { ShareButton: 'ShareButton' };
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? path.join(project, name.slice(2)) : path.resolve(path.dirname(from), name);
      const filename = ['.ts', '.tsx', '.js', ''].map(extension => base + extension).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
      assert(filename, `Cannot resolve ${name} from ${from}`);
      const actual = loadModule(filename);
      if (name.endsWith('/result-media')) return { ...actual, downloadResultFile() {}, encodeResultMp4: async () => { encodingCalls++; throw new Error('simulated encoder failure'); } };
      return actual;
    }
    return projectRequire(name);
  }
  const component = loadModule(componentPath).__reviewOwned;
  return {
    render() { stateCursor = 0; refCursor = 0; effects = []; return component({ src: 'offline-fixture.gif', assetId: 'review-asset', jobId: 'review-job', source: 'composition_result', onRetry() {} }); },
    effectContaining(text) { const effect = effects.find(effect => effect.fn.toString().includes(text)); assert(effect, `Effect containing ${text} was not found; adapt harness after structural refactor`); return effect; },
    tick(timestamp) { now = timestamp; assert(raf, 'No animation callback scheduled'); raf(timestamp); },
    state(name) { const index = stateNames.indexOf(name); assert(index >= 0, `Unknown state ${name}`); return states[index]; },
    get events() { return events; },
    get transitions() { return transitions; },
    get encodingCalls() { return encodingCalls; },
  };
}

async function testPlayback() {
  const harness = createHarness({ gif: fakeGif });
  harness.render();
  const cleanup = harness.effectContaining('requestAnimationFrame').fn();
  let completion;
  for (let tick = 1; tick < 600; tick++) {
    harness.tick(tick * 1000 / 60);
    completion = harness.transitions.find(item => item.index === 0 && item.time > 0);
    if (completion) break;
  }
  cleanup?.();
  assert(completion, 'Playback never finished a cycle');
  assert(completion.time >= cycle && completion.time <= cycle + 1000 / 60 + 0.001, 'Playback must finish within one display tick of the original GIF duration');

  const late = createHarness({ gif: fakeGif });
  late.render();
  const stop = late.effectContaining('requestAnimationFrame').fn();
  late.tick(350);
  stop?.();
  assert.equal(late.state('frameIndex'), 2, 'A late tick must advance to the frame for the current timeline position');
}

async function testMp4Reselect() {
  const harness = createHarness({ gif: fakeGif, format: 'MP4', menuOpen: true });
  harness.render();
  const initial = harness.effectContaining('encodeResultMp4');
  let cleanup = initial.fn();
  await new Promise(setImmediate);
  let tree = harness.render();
  assert(harness.state('conversion').error, 'The simulated initial encoder failure must be visible');
  const option = flatten(tree).find(element => element.type === 'button' && element.props?.['aria-pressed'] === true && element.props?.children?.[0] === 'MP4');
  assert(option, 'Current MP4 menu option must be available');
  option.props.onClick();
  tree = harness.render();
  const next = harness.effectContaining('encodeResultMp4');
  const changed = next.deps.length !== initial.deps.length || next.deps.some((value, index) => !Object.is(value, initial.deps[index]));
  if (changed) { cleanup?.(); cleanup = next.fn(); await new Promise(setImmediate); tree = harness.render(); }
  const error = harness.state('conversion').error;
  cleanup?.();
  assert(error || harness.encodingCalls > 1, 'Reselecting failed MP4 must retain a retryable error or actually retry, rather than show a permanent conversion status');
}

test('preview keeps original variable GIF timing at 60Hz and skips missed frames', testPlayback);
test('reselecting a failed MP4 preserves a retryable error', testMp4Reselect);
test('preview returns to the timeline after a long background pause', () => {
  const harness = createHarness({ gif: fakeGif });
  harness.render();
  const cleanup = harness.effectContaining('requestAnimationFrame').fn();
  harness.tick(cycle * 100000 + 350);
  cleanup();
  assert.equal(harness.state('frameIndex'), 2);
});


test('GIF, PNG, MP4, image copy and file share carry the displayed job and asset', async () => {
  const file = new File(['fixture'], 'result.gif', { type: 'image/gif' });
  for (const [seed, label, expected] of [
    [{ gif: fakeGif, gifFile: file }, 'GIF 저장', 'result_downloaded'],
    [{ gif: fakeGif, frameMode: true }, 'PNG 저장', 'result_export_download_attempted'],
    [{ gif: fakeGif, format: 'MP4', mp4File: file }, 'MP4 저장', 'result_export_download_attempted'],
    [{ gif: fakeGif, frameMode: true }, '선택한 이미지 복사', 'result_image_copied'],
    [{ gif: fakeGif, gifFile: file }, 'GIF 파일 공유', 'result_file_share_resolved'],
  ]) {
    const harness = createHarness(seed);
    const button = flatten(harness.render()).find(element => element.props?.label === label);
    assert(button, `${label} control missing`);
    button.props.onClick();
    await new Promise(setImmediate);
    assert(harness.events.some(event => event.name === expected));
    for (const event of harness.events) {
      assert.equal(event.data.job_id, 'review-job');
      assert.equal(event.data.asset_id, 'review-asset');
    }
  }
  const harness = createHarness({ gif: fakeGif });
  const share = flatten(harness.render()).find(element => element.type === 'ShareButton');
  assert.equal(share.props.jobId, 'review-job');
});
