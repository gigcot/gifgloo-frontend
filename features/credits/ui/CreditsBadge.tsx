"use client";

import { useCredits } from "@/features/credits/model/use-credits";

export function CreditsBadge({ compact = false, anonymous = false }: { compact?: boolean; anonymous?: boolean }) {
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
    <div className="text-right" title={expiration ? `첫 만료 ${expiration} (한국 시간)` : undefined}>
      <p className={compact ? "whitespace-nowrap text-[12px] sm:text-base" : "text-sm font-bold text-white sm:text-base"}>
        {anonymous ? "비회원 · " : ""}사용 가능 {state.remainingUses.toLocaleString()}회
      </p>
      {expiration && !compact && (
        <p className="text-[10px] text-white/40 sm:text-[11px]">첫 만료 {expiration} (한국 시간)</p>
      )}
    </div>
  );
}
