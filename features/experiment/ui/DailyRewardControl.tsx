"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent } from "@/shared/lib/analytics";
import { requestCreditBalanceRefresh } from "@/features/credits/model/use-credits";
import { fetchDailyReward, type DailyRewardStatus } from "../model/daily-reward";

export function DailyRewardControl() {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  const requestVersion = useRef(0);
  const pendingRefresh = useRef<number | null>(null);
  const rewardSection = useRef<HTMLElement>(null);

  const refresh = useCallback(async () => {
    if (submitting.current || pendingRefresh.current !== null) return;
    const version = ++requestVersion.current;
    pendingRefresh.current = version;
    try {
      const next = await fetchDailyReward(authFetch);
      if (requestVersion.current !== version) return;
      setStatus(next);
      setError("");
      setNotice("");
      if (next.claimed) requestCreditBalanceRefresh();
      trackEvent("daily_reward_offer_viewed", { claimed: next.claimed, claim_date: next.claim_date });
    } catch {
      if (requestVersion.current === version) setError("이용권 상태를 불러오지 못했어요. 다시 확인해주세요.");
    } finally {
      if (pendingRefresh.current === version) pendingRefresh.current = null;
    }
  }, [authFetch]);

  useEffect(() => {
    // 서버 응답을 받은 뒤에만 상태를 갱신한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    rewardSection.current?.focus();
    return () => {
      requestVersion.current += 1;
      pendingRefresh.current = null;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!status) return;
    const untilReset = Date.parse(status.next_claim_at) - Date.parse(status.server_now);
    const timer = window.setTimeout(() => void refresh(), untilReset + 500);
    return () => window.clearTimeout(timer);
  }, [refresh, status]);

  async function claim() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const version = ++requestVersion.current;
    trackEvent("daily_reward_claim_clicked");
    try {
      const next = await fetchDailyReward(authFetch, true);
      if (requestVersion.current !== version) return;
      setStatus(next);
      setNotice(next.granted ? "이용권 3회가 지급됐어요." : "오늘은 이미 3회를 받았어요.");
      requestCreditBalanceRefresh();
      trackEvent("daily_reward_claim_confirmed", { granted: next.granted, claim_date: next.claim_date });
    } catch {
      if (requestVersion.current !== version) return;
      setError("이용권 지급을 확인하지 못했어요. 다시 눌러 확인해주세요.");
      trackEvent("daily_reward_claim_failed");
    } finally {
      submitting.current = false;
      if (requestVersion.current === version) setBusy(false);
    }
  }

  const nextClaim = status ? new Intl.DateTimeFormat("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul",
  }).format(new Date(status.next_claim_at)) : "";

  return <section ref={rewardSection} tabIndex={-1} aria-label="매일 이용권" className="border-b border-white/10 p-3">
    <button type="button" disabled={busy || !status || status.claimed} onClick={() => void claim()}
      className="w-full rounded-xl bg-purple-600 px-3 py-3 text-sm font-bold text-white hover:bg-purple-500 disabled:bg-white/10 disabled:text-white/50">
      {busy ? "받는 중…" : status?.claimed ? "오늘 3회 받았어요" : "매일 3회 받기"}
    </button>
    <p className="mt-2 text-xs leading-5 text-white/50">{status?.claimed ? `${nextClaim}부터 다시 받을 수 있어요. (한국시간)` : "하루 한 번 · 한국시간 자정 기준"}<br />받은 이용권은 7일 동안 사용할 수 있어요.</p>
    {notice && <p role="status" className="mt-2 text-xs text-emerald-300">{notice}</p>}
    {error && <div role="alert" className="mt-2 text-xs text-red-300"><p>{error}</p>
      <button type="button" disabled={busy} onClick={() => void refresh()} className="mt-2 underline">상태 다시 확인</button></div>}
  </section>;
}
