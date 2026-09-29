"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { requestCreditBalanceRefresh } from "@/features/credits/model/use-credits";
import {
  type ActualAction,
  type IntendedContext,
  type NonExternalUseReason,
  submitExp001Survey,
} from "@/features/experiment/model/exp-001-survey";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent } from "@/shared/lib/umami";

type Props = {
  open: boolean;
  onClose: () => void;
};

const INTENDED_CONTEXTS: { value: IntendedContext; label: string }[] = [
  { value: "direct_chat", label: "1:1 채팅" },
  { value: "group_chat", label: "단체 채팅방" },
  { value: "community_post", label: "커뮤니티 게시글" },
  { value: "sns", label: "SNS 게시물" },
  { value: "personal_keep", label: "개인 소장" },
  { value: "curiosity", label: "그냥 궁금해서" },
  { value: "other", label: "기타" },
];

const ACTUAL_ACTIONS: { value: ActualAction; label: string }[] = [
  { value: "viewed_only", label: "결과만 확인했다" },
  { value: "saved", label: "기기에 저장했다" },
  { value: "direct_chat", label: "1:1 채팅에 보냈다" },
  { value: "group_chat", label: "단체 채팅방에 보냈다" },
  { value: "community_post", label: "커뮤니티에 올렸다" },
  { value: "sns", label: "SNS에 올렸다" },
  { value: "shared_link", label: "링크를 공유했다" },
  { value: "other", label: "기타" },
];

const NON_EXTERNAL_REASONS: {
  value: NonExternalUseReason;
  label: string;
}[] = [
  { value: "unexpected_result", label: "결과가 기대와 달랐다" },
  { value: "no_situation", label: "쓸 만한 상황이 없었다" },
  { value: "save_share_inconvenient", label: "저장·공유가 불편했다" },
  { value: "showing_burden", label: "다른 사람에게 보여주기 부담스러웠다" },
  { value: "rights_concern", label: "초상권·저작권이 걱정됐다" },
  { value: "curiosity_only", label: "처음부터 결과만 궁금했다" },
  { value: "personal_keep", label: "개인 소장만 하려고 했다" },
  { value: "planned_not_yet", label: "쓸 예정이지만 아직 쓰지 않았다" },
  { value: "other", label: "기타" },
];

const EXTERNAL_ACTIONS = new Set<ActualAction>([
  "direct_chat",
  "group_chat",
  "community_post",
  "sns",
  "shared_link",
]);

function trimmed(value: string): string | undefined {
  const result = value.trim();
  return result || undefined;
}

export function Exp001SurveyDialog({ open, onClose }: Props) {
  const { authFetch, userId } = useAuth();
  const [step, setStep] = useState<"intro" | "survey" | "success">("intro");
  const [intendedContext, setIntendedContext] = useState<IntendedContext | null>(null);
  const [intendedContextOther, setIntendedContextOther] = useState("");
  const [actualActions, setActualActions] = useState<ActualAction[]>([]);
  const [actualActionOther, setActualActionOther] = useState("");
  const [nonExternalReason, setNonExternalReason] = useState<NonExternalUseReason | null>(null);
  const [nonExternalReasonOther, setNonExternalReasonOther] = useState("");
  const [nextContext, setNextContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) trackEvent("exp001_survey_opened");
  }, [open]);

  if (!open) return null;

  const hasExternalAction = actualActions.some((action) => EXTERNAL_ACTIONS.has(action));
  const needsNonExternalReason = actualActions.length > 0 && !hasExternalAction;
  const canSubmit =
    intendedContext !== null &&
    actualActions.length > 0 &&
    (!needsNonExternalReason || nonExternalReason !== null) &&
    (intendedContext !== "other" || trimmed(intendedContextOther) !== undefined) &&
    (!actualActions.includes("other") || trimmed(actualActionOther) !== undefined) &&
    (nonExternalReason !== "other" || trimmed(nonExternalReasonOther) !== undefined);

  function close() {
    if (submitting) return;
    onClose();
    setStep("intro");
    setError(null);
  }

  function toggleActualAction(action: ActualAction) {
    setActualActions((current) => {
      if (action === "viewed_only") {
        return current.includes(action) ? [] : [action];
      }
      const withoutViewedOnly = current.filter((item) => item !== "viewed_only");
      return withoutViewedOnly.includes(action)
        ? withoutViewedOnly.filter((item) => item !== action)
        : [...withoutViewedOnly, action];
    });
  }

  async function submit() {
    if (!canSubmit || !userId || !intendedContext || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitExp001Survey(authFetch, userId, {
        intended_context: intendedContext,
        actual_actions: actualActions,
        ...(intendedContext === "other"
          ? { intended_context_other: trimmed(intendedContextOther) }
          : {}),
        ...(actualActions.includes("other")
          ? { actual_action_other: trimmed(actualActionOther) }
          : {}),
        ...(needsNonExternalReason && nonExternalReason
          ? { non_external_use_reason: nonExternalReason }
          : {}),
        ...(needsNonExternalReason && nonExternalReason === "other"
          ? { non_external_use_reason_other: trimmed(nonExternalReasonOther) }
          : {}),
        ...(trimmed(nextContext) ? { next_context: trimmed(nextContext) } : {}),
      });
      requestCreditBalanceRefresh();
      trackEvent("exp001_survey_submitted");
      setStep("success");
    } catch {
      setError("응답을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
      onClick={close}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exp001-survey-title"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#151217] p-6 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        {step === "intro" && (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/15 text-2xl">
              🎁
            </div>
            <h2 id="exp001-survey-title" className="mt-5 text-xl font-bold text-white">
              설문에 참여하시면 이용권 1회를 드립니다
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/55">
              완성된 GIF를 어디에 쓰려고 했고 실제로 어떻게 사용했는지 알려주세요.
              다음 실험에서 무엇을 개선할지 정하는 데 활용합니다.
            </p>
            <p className="mt-3 text-xs text-white/35">약 1분 · 계정당 1회 지급</p>
            <div className="mt-7 flex w-full gap-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 rounded-full border border-white/15 py-3 text-sm font-semibold text-white/60 hover:border-white/30 hover:text-white"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("survey");
                  trackEvent("exp001_survey_started");
                }}
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-500"
              >
                설문 시작
              </button>
            </div>
          </div>
        )}

        {step === "survey" && (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="exp001-survey-title" className="text-xl font-bold text-white">
                  완성된 GIF 사용 경험
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="설문 닫기"
                className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <fieldset className="mt-7">
              <legend className="text-sm font-bold text-white">
                1. 이 GIF를 어디에서 사용하려고 만들었나요?
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {INTENDED_CONTEXTS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/70 has-checked:border-purple-400/60 has-checked:bg-purple-500/10 has-checked:text-purple-100"
                  >
                    <input
                      type="radio"
                      name="intended-context"
                      value={option.value}
                      checked={intendedContext === option.value}
                      onChange={() => setIntendedContext(option.value)}
                      className="accent-purple-500"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {intendedContext === "other" && (
                <input
                  value={intendedContextOther}
                  onChange={(event) => setIntendedContextOther(event.target.value)}
                  maxLength={500}
                  placeholder="어디에서 쓰려고 했는지 적어주세요"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-purple-400/60"
                />
              )}
            </fieldset>

            <fieldset className="mt-7">
              <legend className="text-sm font-bold text-white">
                2. 완성된 GIF로 실제로 무엇을 했나요?
              </legend>
              <p className="mt-1 text-xs text-white/40">여러 개 선택할 수 있어요.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ACTUAL_ACTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/70 has-checked:border-purple-400/60 has-checked:bg-purple-500/10 has-checked:text-purple-100"
                  >
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={actualActions.includes(option.value)}
                      onChange={() => toggleActualAction(option.value)}
                      className="accent-purple-500"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              {actualActions.includes("other") && (
                <input
                  value={actualActionOther}
                  onChange={(event) => setActualActionOther(event.target.value)}
                  maxLength={500}
                  placeholder="실제로 한 행동을 적어주세요"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-purple-400/60"
                />
              )}
            </fieldset>

            {needsNonExternalReason && (
              <fieldset className="mt-7">
                <legend className="text-sm font-bold text-white">
                  3. 채팅·게시글·링크 공유로 사용하지 않은 가장 큰 이유는 무엇인가요?
                </legend>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {NON_EXTERNAL_REASONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/70 has-checked:border-purple-400/60 has-checked:bg-purple-500/10 has-checked:text-purple-100"
                    >
                      <input
                        type="radio"
                        name="non-external-reason"
                        value={option.value}
                        checked={nonExternalReason === option.value}
                        onChange={() => setNonExternalReason(option.value)}
                        className="accent-purple-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {nonExternalReason === "other" && (
                  <input
                    value={nonExternalReasonOther}
                    onChange={(event) => setNonExternalReasonOther(event.target.value)}
                    maxLength={500}
                    placeholder="가장 큰 이유를 적어주세요"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-purple-400/60"
                  />
                )}
              </fieldset>
            )}

            <label className="mt-7 block text-sm font-bold text-white">
              {needsNonExternalReason ? "4" : "3"}. 다음에 다시 쓴다면 어떤 상황에서 쓰고 싶나요?
              <span className="ml-1 font-normal text-white/35">(선택)</span>
              <textarea
                value={nextContext}
                onChange={(event) => setNextContext(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="예: 친구 단톡방에서 반응 짤로"
                className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-normal text-white outline-none placeholder:text-white/25 focus:border-purple-400/60"
              />
            </label>

            {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || submitting}
              className="mt-6 w-full rounded-full bg-purple-600 py-3.5 text-sm font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {submitting ? "제출 중..." : "제출하고 이용권 1회 받기"}
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
              ✓
            </div>
            <h2 id="exp001-survey-title" className="mt-5 text-xl font-bold text-white">
              이용권 1회가 지급됐어요
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              답변 고마워요. 지급된 이용권은 7일 동안 사용할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-7 w-full rounded-full bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-500"
            >
              확인
            </button>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
