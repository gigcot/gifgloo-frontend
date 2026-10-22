"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent, trackEventOnce } from "@/shared/lib/analytics";
import { refreshExp001SurveyStatus, useExp001SurveyStatus } from "@/features/experiment/model/exp-001-survey";
import { requestExp001SurveyOpen } from "@/features/experiment/model/exp-001-survey-open";

export function Exp001SurveyInvitation({ onOpen, source }: {
  onOpen?: () => void;
  source: "my_assets" | "my_assets_page" | "notification_return" | "composition_result";
}) {
  const { authFetch, userId } = useAuth();
  const survey = useExp001SurveyStatus();
  const invitation = useRef<HTMLElement>(null);
  const visible = survey.status === "done" && survey.eligible && !survey.submitted;

  useEffect(() => {
    if (userId) void refreshExp001SurveyStatus(authFetch, userId, { reusePending: true });
  }, [authFetch, userId]);

  useEffect(() => {
    const element = invitation.current;
    if (!visible || !element || !userId) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      trackEventOnce(`survey_invitation:${userId}:${source}`, "survey_reward_offer_viewed", { source });
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [source, userId, visible]);

  if (!visible) return null;

  return <section ref={invitation} aria-label="추가 설문 안내" className="rounded-2xl border border-white/10 p-4 text-sm text-white/65">
    <p className="font-semibold text-white/85">더 만들어보고 싶나요?</p>
    <p className="mt-2 leading-6">설문에 참여하면 이용권 1회를 드려요.<br />참여 후에는 프로필에서 매일 3회분을 더 받을 수 있어요.</p>
    <p className="mt-1 text-xs text-white/45">설문은 한 번만 · 결과 평가와는 별도의 선택 설문이에요.</p>
    <button type="button" className="mt-2 min-h-11 underline" onClick={() => {
      trackEvent("exp001_survey_cta_clicked", { source });
      onOpen?.();
      requestExp001SurveyOpen();
    }}>설문 참여하기</button>
  </section>;
}
