"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/shared/lib/use-auth";
import { API_BASE } from "@/shared/lib/api-base";
import { currentPathForPaymentReturn, setPaymentReturnIntent } from "@/shared/lib/payment-return";
import { runAfterCompositionFeedback } from "@/shared/lib/composition-feedback-guard";

import { useExp001SurveyStatus } from "@/features/experiment/model/exp-001-survey";
import { DailyRewardControl } from "@/features/experiment/ui/DailyRewardControl";
import { trackEvent } from "@/shared/lib/analytics";

const MENU_ITEMS = [
  { label: "홈", href: "/" },
  { label: "내 에셋", href: "/my-assets" },
  { label: "결제 및 이용 내역", href: "/payment/history" },
  { label: "이용권 구매", href: "/payment/charge" },
  { label: "합성하기", href: "/compose" },
] as const;

export function UserMenu({ onConnect }: { onConnect?: () => void }) {
  const router = useRouter();
  const { authFetch, isLoggedIn, userId } = useAuth();
  const survey = useExp001SurveyStatus();
  const hasDailyReward = survey.status === "done" && survey.submitted;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    const showRewards = (event: Event) => {
      if (!hasDailyReward) return;
      setOpen(true);
      trackEvent("daily_reward_menu_opened", { source: (event as CustomEvent<{ source: string }>).detail.source });
    };
    document.addEventListener("open-daily-reward-menu", showRewards);
    return () => document.removeEventListener("open-daily-reward-menu", showRewards);
  }, [hasDailyReward]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

  async function handleLogout() {
    await authFetch(`${API_BASE}/oauth/logout`, { method: "POST" });
    // 로그아웃 시 메모리의 인증·이용량 캐시도 초기화해야 한다.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef} aria-label="프로필" aria-expanded={open}
        onClick={() => runAfterCompositionFeedback(() => {
          if (!open && hasDailyReward) trackEvent("daily_reward_menu_opened", { source: "profile" });
          setOpen((v) => !v);
        })}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white transition-colors hover:bg-purple-700"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-xl">
          {hasDailyReward && <DailyRewardControl key={userId} />}
          {!isLoggedIn && <div className="px-4 py-3 text-xs leading-5 text-white/50">비회원으로 이용 중이에요.<br />계정을 연결하면 다른 기기에서도 이어서 사용할 수 있어요.</div>}
          {MENU_ITEMS.filter(item => isLoggedIn || !item.href.startsWith("/payment")).map(({ label, href }) => (
            <button
              key={label}
              onClick={() => {
                if (href === "/payment/charge") {
                  setPaymentReturnIntent({
                    href: currentPathForPaymentReturn(),
                    label: "이전 화면으로 계속하기",
                  });
                }
                setOpen(false);
                router.push(href);
              }}
              className="w-full px-4 py-3 text-left text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              {label}
            </button>
          ))}
          <div className="border-t border-white/10" />
          {isLoggedIn ? <button
            onClick={handleLogout}
            className="w-full px-4 py-3 text-left text-sm font-medium text-red-400 transition-colors hover:bg-white/5"
          >
            로그아웃
          </button> : <button type="button" onClick={() => { setOpen(false); onConnect?.(); }} className="w-full px-4 py-3 text-left text-sm text-purple-300">계정 연결</button>}
        </div>
      )}
    </div>
  );
}
