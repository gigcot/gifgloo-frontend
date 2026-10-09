"use client";

import { useEffect } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent } from "@/shared/lib/umami";
import { refreshExp001SurveyStatus, useExp001SurveyStatus } from "@/features/experiment/model/exp-001-survey";
import { requestExp001SurveyOpen } from "@/features/experiment/model/exp-001-survey-open";

export function Exp001SurveyInvitation({ onOpen, source }: {
  onOpen?: () => void;
  source: "my_assets" | "notification_return";
}) {
  const { authFetch, userId } = useAuth();
  const survey = useExp001SurveyStatus();

  useEffect(() => {
    if (userId) void refreshExp001SurveyStatus(authFetch, userId);
  }, [authFetch, userId]);

  if (survey.status !== "done" || !survey.eligible || survey.submitted) return null;

  return <section aria-label="추가 설문 안내" className="rounded-2xl border border-white/10 p-4 text-sm text-white/65">
    <p>이용 경험을 알려주시면 이용권 1회를 드려요.</p>
    <p className="mt-1 text-xs text-white/45">결과 평가와는 별도의 선택 설문이에요.</p>
    <button type="button" className="mt-2 min-h-11 underline" onClick={() => {
      trackEvent("exp001_survey_cta_clicked", { source });
      onOpen?.();
      requestExp001SurveyOpen();
    }}>설문 참여하기</button>
  </section>;
}
