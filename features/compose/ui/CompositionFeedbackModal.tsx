"use client";

import { useEffect, useState } from "react";
import { submitCompositionFeedback } from "@/features/compose/model/composition-feedback-api";
import { trackEvent } from "@/shared/lib/umami";

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type Props = {
  authFetch: AuthFetch;
  compositionJobId: string;
  resultUrl: string;
  onClose: () => void;
};

export function CompositionFeedbackModal({
  authFetch,
  compositionJobId,
  resultUrl,
  onClose,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(satisfied: boolean) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      await submitCompositionFeedback(authFetch, compositionJobId, satisfied);
      trackEvent("composition_feedback_submitted", { satisfied });
      onClose();
    } catch {
      setError("응답을 저장하지 못했어요. 다시 눌러주세요.");
      setSubmitting(false);
    }
  }

  function dismiss() {
    if (submitting) return;
    trackEvent("composition_feedback_skipped");
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151317] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <img
          src={resultUrl}
          alt="평가할 합성 결과"
          className="mx-auto h-40 w-40 rounded-2xl bg-black object-contain"
        />
        <h2 id="feedback-title" className="mt-5 text-center text-lg font-bold text-white">
          결과물이 마음에 드나요?
        </h2>
        <p className="mt-2 text-center text-sm text-white/45">
          답변은 다음 합성 결과를 개선하는 데 사용돼요.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={submitting}
            className="rounded-2xl border border-white/15 bg-white/[0.03] py-4 text-sm font-semibold text-white/70 transition-colors hover:border-white/35 hover:text-white disabled:opacity-40"
          >
            아쉬워요
          </button>
          <button
            type="button"
            onClick={() => void submit(true)}
            disabled={submitting}
            className="rounded-2xl bg-purple-600 py-4 text-sm font-bold text-white transition-colors hover:bg-purple-500 disabled:opacity-40"
          >
            만족해요
          </button>
        </div>

        {error && <p role="alert" className="mt-3 text-center text-xs text-red-300">{error}</p>}
      </div>
    </div>
  );
}
