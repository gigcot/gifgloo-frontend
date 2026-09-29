import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../../features/experiment/model/exp-001-survey.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function loadSurvey() {
  const sandbox = {
    exports: {},
    require(name) {
      if (name === "react") return {
        useEffect: () => {},
        useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
      };
      if (name === "@/shared/lib/api-base") return { API_BASE: "https://test.invalid" };
      if (name === "@/shared/lib/use-auth") return {
        useAuth: () => ({ userId: "survey-user" }),
      };
      throw new Error(`Unexpected module: ${name}`);
    },
  };
  runInNewContext(compiled, sandbox);
  return sandbox.exports;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function response(data) {
  return { ok: true, json: async () => data };
}

const answers = { intended_context: "group_chat", actual_actions: ["group_chat"] };

for (const outcome of ["success", "failure"]) {
  test(`late GET ${outcome} cannot undo a successful submission`, async () => {
    const survey = loadSurvey();
    const pending = deferred();
    const fetch = async (_url, init) => init?.method === "POST"
      ? response({ submitted: true })
      : pending.promise;
    const loading = survey.refreshExp001SurveyStatus(fetch, "survey-user");
    await survey.submitExp001Survey(fetch, "survey-user", answers);
    assert.equal(survey.useExp001SurveyStatus().submitted, true);

    if (outcome === "success") pending.resolve(response({ eligible: true, submitted: false }));
    else pending.reject(new Error("delayed failure"));
    await loading;

    assert.equal(survey.useExp001SurveyStatus().status, "done");
    assert.equal(survey.useExp001SurveyStatus().submitted, true);
  });
}

test("forced refresh supersedes the older request and its cleanup", async () => {
  const survey = loadSurvey();
  const old = deferred();
  const latest = deferred();
  let calls = 0;
  const fetch = () => ++calls === 1 ? old.promise : latest.promise;
  const oldLoading = survey.refreshExp001SurveyStatus(fetch, "survey-user");
  const latestLoading = survey.refreshExp001SurveyStatus(fetch, "survey-user");
  assert.equal(calls, 2);

  old.resolve(response({ eligible: false, submitted: false }));
  await oldLoading;
  assert.equal(survey.useExp001SurveyStatus().status, "loading");
  latest.resolve(response({ eligible: true, submitted: false }));
  await latestLoading;
  assert.equal(survey.useExp001SurveyStatus().eligible, true);
});

test("failed POST leaves the pending status request valid", async () => {
  const survey = loadSurvey();
  const pending = deferred();
  const fetch = async (_url, init) => init?.method === "POST"
    ? { ok: false }
    : pending.promise;
  const loading = survey.refreshExp001SurveyStatus(fetch, "survey-user");
  await assert.rejects(survey.submitExp001Survey(fetch, "survey-user", answers));
  pending.resolve(response({ eligible: true, submitted: false }));
  await loading;
  assert.equal(survey.useExp001SurveyStatus().status, "done");
  assert.equal(survey.useExp001SurveyStatus().submitted, false);
});
