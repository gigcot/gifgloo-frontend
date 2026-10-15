import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function compile(relativePath) {
  return ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

const browserCode = compile("../../features/gif-search/model/use-gif-browser.ts");
const gifCode = compile("../../entities/gif/model.ts");

function loadBrowser(storage = new Map()) {
  const requests = [];
  const gifModule = { exports: {} };
  runInNewContext(gifCode, gifModule);
  function request(query, page, perPage, signal) {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    requests.push({ query, page, perPage, signal, resolve, reject });
    return promise;
  }
  const sandbox = {
    exports: {}, window: {}, AbortController,
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    require(name) {
      if (name === "react") return {
        useCallback: callback => callback,
        useEffect: effect => effect(),
        useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      };
      if (name === "@/entities/gif/model") return gifModule.exports;
      if (name === "@/shared/api/klipy") return {
        fetchTrendingPage: (page, perPage, signal) => request("", page, perPage, signal),
        fetchSearchPage: request,
      };
      if (name === "@/shared/lib/umami") return { trackEvent() {} };
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  runInNewContext(browserCode, sandbox);
  return {
    ...sandbox.exports, requests, storage,
    read: surface => sandbox.exports.useGifBrowser(surface),
    getGifUrl: gifModule.exports.getGifUrl,
  };
}

function gif(id) {
  const format = url => ({ url, width: 320, height: 240, size: 1024 });
  return {
    id, slug: id, title: id, blur_preview: "",
    file: {
      hd: { gif: format(`https://test.invalid/${id}-original.gif`), mp4: format(`https://test.invalid/${id}.mp4`) },
      md: { gif: format(`https://test.invalid/${id}-medium.gif`) },
      sm: { gif: format(`https://test.invalid/${id}-thumb.gif`) }, xs: {},
    },
  };
}

async function complete(request, items, hasNext = true) {
  request.resolve({ items, currentPage: request.page, hasNext });
  await setImmediate();
}

function ids(state) { return Array.from(state.items, item => item.id); }

test("home and compose keep independent searches and results", async () => {
  const browser = loadBrowser();
  browser.read("home");
  browser.read("compose");
  assert.equal(browser.requests.length, 2);
  browser.read("home").search("dancing", "춤추기", "actions", "dancing");
  assert.equal(browser.requests[0].signal.aborted, true);
  assert.equal(browser.requests[1].signal.aborted, false);
  await complete(browser.requests[0], [gif("obsolete-home")]);
  await complete(browser.requests[1], [gif("compose-trending")]);
  await complete(browser.requests[2], [gif("home-dancing")]);
  assert.equal(browser.read("home").state.query, "dancing");
  assert.deepEqual(ids(browser.read("home").state), ["home-dancing"]);
  assert.equal(browser.read("compose").state.query, "");
  assert.deepEqual(ids(browser.read("compose").state), ["compose-trending"]);
  browser.read("home").showCategory("movies", "영화");
  assert.equal(browser.read("home").state.view, "topics");
  assert.deepEqual(ids(browser.read("compose").state), ["compose-trending"]);
});

test("a failed next page keeps prior results and retries that page once with boundary deduplication", async () => {
  const browser = loadBrowser();
  browser.read("home");
  await complete(browser.requests[0], [gif("first"), gif("second")]);
  const controls = browser.read("home");
  controls.loadMore();
  controls.loadMore();
  assert.equal(browser.requests.length, 2);
  assert.equal(browser.requests[1].page, 2);
  browser.requests[1].reject(new Error("temporary provider failure"));
  await setImmediate();
  assert.equal(browser.read("home").state.error, true);
  assert.equal(browser.read("home").state.page, 1);
  assert.deepEqual(ids(browser.read("home").state), ["first", "second"]);
  browser.read("home").retry();
  assert.equal(browser.requests[2].page, 2);
  await complete(browser.requests[2], [gif("second"), gif("third")], false);
  assert.deepEqual(ids(browser.read("home").state), ["first", "second", "third"]);
  assert.equal(browser.read("home").state.page, 2);
  assert.equal(browser.read("home").state.error, false);
  browser.read("home").loadMore();
  assert.equal(browser.requests.length, 3);
});

for (const outcome of ["success", "failure"]) test(`late pagination ${outcome} cannot overwrite the next query or its loading state`, async () => {
  const browser = loadBrowser();
  browser.read("home");
  await complete(browser.requests[0], [gif("trending")]);
  browser.read("home").search("cat", "cat");
  await complete(browser.requests[1], [gif("cat-page-1")]);
  browser.read("home").loadMore();
  const oldRequest = browser.requests[2];
  browser.read("home").search("dog", "dog");
  const nextRequest = browser.requests[3];
  assert.equal(oldRequest.signal.aborted, true);
  if (outcome === "success") await complete(oldRequest, [gif("cat-page-2")]);
  else { oldRequest.reject(new Error("late failure")); await setImmediate(); }
  assert.equal(browser.read("home").state.query, "dog");
  assert.equal(browser.read("home").state.loading, true);
  assert.equal(browser.read("home").state.error, false);
  assert.deepEqual(ids(browser.read("home").state), []);
  await complete(nextRequest, [gif("dog-page-1")]);
  assert.deepEqual(ids(browser.read("home").state), ["dog-page-1"]);
  assert.equal(browser.read("home").state.loading, false);
});

test("restored browsing retains the canonical HD GIF, topic and scroll without refetching", async () => {
  const browser = loadBrowser();
  browser.read("home");
  browser.read("home").search("dancing", "춤추기", "actions", "dancing");
  const original = gif("chosen");
  await complete(browser.requests[1], [original], false);
  browser.rememberGifBrowsePosition("home", 742);
  const returned = loadBrowser(browser.storage);
  returned.read("home");
  const restored = returned.read("home").state;
  assert.equal(returned.requests.length, 0);
  assert.equal(restored.categoryId, "actions");
  assert.equal(restored.topicQuery, "dancing");
  assert.equal(restored.input, "춤추기");
  assert.equal(restored.scrollTop, 742);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.items[0])), original);
  assert.equal(returned.getGifUrl(restored.items[0], "hd"), "https://test.invalid/chosen-original.gif");
  assert.equal(returned.getGifUrl(restored.items[0], "sm"), "https://test.invalid/chosen-thumb.gif");
});
