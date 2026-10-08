"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { CreditsBadge } from "@/features/credits/ui/CreditsBadge";
import { UserMenu } from "@/features/auth/ui/UserMenu";
import { LoginModal } from "./LoginModal";
import { Exp001SurveyDialog } from "@/features/experiment/ui/Exp001SurveyDialog";
import { useExp001SurveyStatus } from "@/features/experiment/model/exp-001-survey";
import { listenForExp001SurveyOpen } from "@/features/experiment/model/exp-001-survey-open";
import Link from "next/link";
import { currentPathForPaymentReturn, setPaymentReturnIntent } from "@/shared/lib/payment-return";
import { trackEvent } from "@/shared/lib/umami";

type Props = {
  onLogin?: () => void;
  compact?: boolean;
};

export function HeaderActions({ onLogin, compact = false }: Props) {
  const { isLoggedIn, hasUserSession, checked } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const survey = useExp001SurveyStatus();
  const [showSurvey, setShowSurvey] = useState(false);

  const showSurveyCta =
    survey.status === "done" && survey.eligible && !survey.submitted;

  useEffect(() => {
    return listenForExp001SurveyOpen(() => {
      if (showSurveyCta) setShowSurvey(true);
    });
  }, [showSurveyCta]);

  function openSurvey() {
    trackEvent("exp001_survey_cta_clicked");
    setShowSurvey(true);
  }

  if (!checked) return null;

  if (hasUserSession) {
    return (
      <>
        <div className="ml-auto flex items-center gap-3">
          <CreditsBadge compact={compact} anonymous={!isLoggedIn} />
          {showSurveyCta && !compact && (
            <button
              type="button"
              onClick={openSurvey}
              className="hidden rounded-full bg-purple-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-purple-500 sm:block"
            >
              사용횟수 더 받기
            </button>
          )}
          {isLoggedIn && !compact && <Link
            href="/payment/charge"
            onClick={() => {
              setPaymentReturnIntent({
                href: currentPathForPaymentReturn(),
                label: "이전 화면으로 계속하기",
              });
            }}
            className="hidden rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-100 transition-colors hover:bg-purple-500/20 sm:block"
          >
            구매
          </Link>}
          {compact ? <><Link href="/my-assets" className="text-action text-sm whitespace-nowrap">내 결과</Link>{isLoggedIn && <UserMenu />}</> : isLoggedIn ? <UserMenu /> : <>
            <Link href="/my-assets" className="text-sm text-white/70">내 결과</Link>
            <button onClick={() => setShowLogin(true)} className="text-sm text-purple-300">계정 연결</button>
          </>}
        </div>
        {showSurveyCta && !compact && (
          <div className="order-last basis-full sm:hidden">
            <button
              type="button"
              onClick={openSurvey}
              className="w-full rounded-full bg-purple-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-500"
            >
              사용횟수 더 받기
            </button>
          </div>
        )}
        <Exp001SurveyDialog
          open={showSurvey}
          onClose={() => setShowSurvey(false)}
        />
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={onLogin ?? (() => setShowLogin(true))}
        className="ml-auto rounded-full bg-purple-600 px-5 py-2 text-base font-semibold text-white transition-colors hover:bg-purple-700"
      >
        로그인
      </button>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
