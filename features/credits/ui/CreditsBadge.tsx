"use client";

import { useCredits } from "@/features/credits/model/use-credits";

export function CreditsBadge() {
  const state = useCredits();

  if (state.status === "loading") {
    return <div className="h-5 w-16 animate-pulse rounded-full bg-white/10" />;
  }

  if (state.status === "error") return null;

  return (
    <span className="text-base font-bold text-white">
      {state.balance.toLocaleString()} 크레딧
    </span>
  );
}
