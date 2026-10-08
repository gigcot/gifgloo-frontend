import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const parser = ts.transpileModule(readFileSync(new URL("../../features/gif-search/model/gif-frame-parser.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const sandbox = { exports: {} };
runInNewContext(parser, sandbox);
const count = sandbox.exports.countGifFrames;
const still = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");
test("counts image descriptors rather than byte patterns inside image data", () => {
  assert.equal(count(still), 1);
  const animated = Buffer.concat([still.subarray(0, 19), ...Array(20).fill(still.subarray(19, -1)), Buffer.from([0x3b])]);
  assert.equal(count(animated), 20);
});
test("rejects non-GIF, truncation and missing trailer", () => {
  for (const invalid of [Buffer.from("not a gif"), still.subarray(0, 22), still.subarray(0, -1)]) assert.throws(() => count(invalid));
});
test("service worker shows a job-scoped notification and rejects external click targets", async () => {
  const handlers = {}, notifications = [], opened = [];
  const self = {
    location: { origin: "https://gifgloo.test" },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    registration: { showNotification: async (...args) => notifications.push(args) },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
  };
  runInNewContext(readFileSync(new URL("../../public/completion-notifications-sw.js", import.meta.url), "utf8"), { self, URL });
  let pending;
  handlers.push({ data: { json: () => ({ job_id: "job-1", url: "https://evil.test" }) }, waitUntil: value => { pending = value; } });
  await pending;
  assert.equal(notifications[0][1].tag, "gifgloo-complete-job-1");
  assert.equal(notifications[0][1].data.url, "/my-assets?job=job-1&from=notification");
  handlers.notificationclick({ notification: { close() {}, data: { url: "https://evil.test" } }, waitUntil: value => { pending = value; } });
  await pending;
  assert.equal(opened[0], "https://gifgloo.test/my-assets");
});
