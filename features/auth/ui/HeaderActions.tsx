"use client";

import { useAuth } from "@/shared/lib/use-auth";
import { CreditsBadge } from "@/features/credits/ui/CreditsBadge";
import { UserMenu } from "@/features/auth/ui/UserMenu";

type Props = {
  onLogin?: () => void;
};

export function HeaderActions({ onLogin }: Props) {
  const { isLoggedIn, checked } = useAuth();

  if (!checked) return null;

  if (isLoggedIn) {
    return (
      <div className="flex items-center gap-3">
        <CreditsBadge />
        <UserMenu />
      </div>
    );
  }

  if (onLogin) {
    return (
      <button
        onClick={onLogin}
        className="rounded-full bg-purple-600 px-5 py-2 text-base font-semibold text-white transition-colors hover:bg-purple-700"
      >
        로그인
      </button>
    );
  }

  return null;
}
