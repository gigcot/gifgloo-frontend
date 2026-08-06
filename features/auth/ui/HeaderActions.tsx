"use client";

import { useAuth } from "@/shared/lib/use-auth";
import { CreditsBadge } from "@/features/credits/ui/CreditsBadge";
import { UserMenu } from "@/features/auth/ui/UserMenu";
import Link from "next/link";
import { currentPathForPaymentReturn, setPaymentReturnIntent } from "@/shared/lib/payment-return";

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
        <Link
          href="/payment/charge"
          onClick={() => {
            setPaymentReturnIntent({
              href: currentPathForPaymentReturn(),
              label: "이전 화면으로 계속하기",
            });
          }}
          className="hidden rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-100 transition-colors hover:bg-purple-500/20 sm:block"
        >
          충전
        </Link>
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
