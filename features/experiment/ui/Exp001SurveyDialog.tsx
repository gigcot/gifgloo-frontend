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
import { requestDailyRewardMenuOpen } from "../model/daily-reward";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent } from "@/shared/lib/analytics";

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
  { value: "viewed_only", label: "아직 결과만 확인했어요" },
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
  const [nonExternalReasons, setNonExternalReasons] = useState<NonExternalUseReason[]>([]);
  const [nonExternalReasonOther, setNonExternalReasonOther] = useState("");
  const [nextContext, setNextContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) trackEvent("exp001_survey_opened");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const hasExternalAction = actualActions.some((action) => EXTERNAL_ACTIONS.has(action));
  const needsNonExternalReason = actualActions.length > 0 && !hasExternalAction;
  const canSubmit =
    intendedContext !== null &&
    actualActions.length > 0 &&
    (!needsNonExternalReason || nonExternalReasons.length > 0) &&
    (intendedContext !== "other" || trimmed(intendedContextOther) !== undefined) &&
    (!actualActions.includes("other") || trimmed(actualActionOther) !== undefined) &&
    (!needsNonExternalReason || !nonExternalReasons.includes("other") || trimmed(nonExternalReasonOther) !== undefined);

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
        ...(needsNonExternalReason
          ? { non_external_use_reasons: nonExternalReasons }
          : {}),
        ...(needsNonExternalReason && nonExternalReasons.includes("other")
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
      className="fixed inset-0 z-[70] flex items-center justify-center overscroll-contain bg-black/70 px-4 py-8 backdrop-blur-sm"
      onClick={close}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="exp001-survey-title"
        className="flex max-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#151217] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {step === "intro" && (
          <div className="flex flex-col items-center p-6 text-center sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/15 text-2xl">
              🎁
            </div>
            <h2 id="exp001-survey-title" className="mt-5 text-xl font-bold text-white">
              설문 참여하고 추가 이용권 받기
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/55">
              제출하면 이용권 1회를 바로 드려요.
              이후에는 프로필에서 매일 3회분을 더 받을 수 있어요.
            </p>
            <p className="mt-3 text-xs text-white/35">설문은 한 번만 · 어떤 답변을 선택해도 같은 혜택</p>
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
          <div className="flex min-h-0 flex-1 flex-col">
            <div
              data-testid="exp001-survey-scroll"
              className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8"
            >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="exp001-survey-title" className="text-xl font-bold text-white">
                  지금까지의 합성 경험
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
                1. 처음 GIF를 만들 때 어떤 용도로 쓰려고 했나요?
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
                2. 지금까지 만든 GIF로 무엇을 했나요?
              </legend>
              <p className="mt-1 text-xs text-white/40">아직 사용하지 않았다면 결과만 확인했다고 답해도 괜찮아요. 여러 개 선택할 수 있어요.</p>
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
                  3. 채팅·게시글·링크 공유로 사용하지 않은 이유를 모두 골라주세요.
                </legend>
                <p className="mt-1 text-xs text-white/40">여러 개 선택할 수 있어요.</p>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  {NON_EXTERNAL_REASONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/70 has-checked:border-purple-400/60 has-checked:bg-purple-500/10 has-checked:text-purple-100"
                    >
                      <input
                        type="checkbox"
                        name="non-external-reason"
                        value={option.value}
                        checked={nonExternalReasons.includes(option.value)}
                        onChange={() => setNonExternalReasons((current) =>
                          current.includes(option.value)
                            ? current.filter((reason) => reason !== option.value)
                            : [...current, option.value],
                        )}
                        className="accent-purple-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                {nonExternalReasons.includes("other") && (
                  <input
                    value={nonExternalReasonOther}
                    onChange={(event) => setNonExternalReasonOther(event.target.value)}
                    maxLength={500}
                    placeholder="그 밖의 이유를 적어주세요"
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
            </div>
            <div className="shrink-0 border-t border-white/10 bg-[#151217] px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || submitting}
              className="w-full rounded-full bg-purple-600 py-3.5 text-sm font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {submitting ? "제출 중..." : "제출하고 이용권 1회 받기"}
            </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center p-6 text-center sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
              ✓
            </div>
            <h2 id="exp001-survey-title" className="mt-5 text-xl font-bold text-white">
              이용권 1회가 지급됐어요
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              받은 이용권은 7일 동안 사용할 수 있어요.
              오늘 3회분도 더 받을 수 있어요. 다음부터는 오른쪽 위 프로필의 ‘매일 3회 받기’를 눌러주세요.
            </p>
            <button
              type="button"
              onClick={() => { close(); requestDailyRewardMenuOpen("survey_success"); }}
              className="mt-7 w-full rounded-full bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-500"
            >
              프로필에서 3회 더 받기
            </button>
            <button type="button" onClick={close} className="mt-3 py-2 text-sm text-white/50">나중에 받기</button>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
