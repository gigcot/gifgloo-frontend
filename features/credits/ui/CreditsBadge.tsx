"use client";

import { useCredits } from "@/features/credits/model/use-credits";

export function CreditsBadge() {
  const state = useCredits();

  if (state.status === "loading") {
    return <div className="h-5 w-16 animate-pulse rounded-full bg-white/10" />;
  }

  if (state.status === "error") return null;

  const expiration = state.nearestExpiresAt
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      }).format(new Date(state.nearestExpiresAt))
    : null;

  return (
    <div className="text-right">
      <p className="text-sm font-bold text-white sm:text-base">
        합성 {state.remainingUses.toLocaleString()}회
      </p>
      {expiration && (
        <p className="hidden text-[11px] text-white/40 sm:block">가장 빠른 만료 {expiration}</p>
      )}
    </div>
  );
}
