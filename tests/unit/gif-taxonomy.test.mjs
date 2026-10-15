import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../features/gif-search/model/taxonomy.ts", import.meta.url), "utf8");
const sandbox = { exports: {} };
runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, sandbox);
const { findTopicMatches } = sandbox.exports;
const { categories } = JSON.parse(readFileSync(new URL("../../features/gif-search/model/taxonomy.json", import.meta.url), "utf8"));
const queries = input => Array.from(findTopicMatches(categories, input), ({ topic }) => topic.query);

test("Korean initials find topics before completing a syllable", () => {
  assert.ok(queries("ㅇ").includes("laughing"));
  assert.ok(queries("ㅌ").includes("abandon thread"));
  assert.ok(queries("ㄷㅂ").includes("smoking"));
  assert.ok(queries("ㄷㅂㅍㅇㄱ").includes("smoking"));
  assert.ok(!queries("ㅌ").includes("smoking"));
});

test("mixed completed syllables and initials keep matching while typing", () => {
  for (const input of ["담ㅂ", "담배 ㅍ", "담배 피ㅇ", "ㄷ ㅂ", "ㅊㅊㄱ"]) {
    assert.ok(queries(input).includes(input === "ㅊㅊㄱ" ? "dancing" : "smoking"), input);
  }
});

test("literal Korean and English matching and deduplication remain intact", () => {
  assert.ok(queries("담배 피우기").includes("smoking"));
  assert.ok(queries(" SMOK ").includes("smoking"));
  assert.ok(queries("d").includes("dancing"));
  assert.deepEqual(queries("  "), []);
  for (const input of ["ㅇ[", "ㄷ.*", "ㅌ(", "ㅇ\\", "없는검색어"]) assert.deepEqual(queries(input), []);
  const matches = queries("ㅇ");
  assert.equal(matches.length, new Set(matches).size);
});
