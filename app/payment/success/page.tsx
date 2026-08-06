"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import type { PaymentReturnIntent } from "@/shared/lib/payment-return";
import { clearPaymentReturnIntent, getPaymentReturnIntent } from "@/shared/lib/payment-return";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [returnIntent, setReturnIntent] = useState<PaymentReturnIntent | null>(null);

  useEffect(() => {
    setReturnIntent(getPaymentReturnIntent());
  }, []);

  function handleContinue() {
    const href = returnIntent?.href ?? "/";
    clearPaymentReturnIntent();
    router.replace(href);
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header title="결제 완료" action={<HeaderActions />} />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-sm font-semibold text-purple-300">payment complete</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">결제가 완료됐어요</h1>
        <p className="mt-4 text-sm leading-6 text-white/50">
          곧 계정에 크레딧이 지급될 거예요. 반영까지 잠시 걸릴 수 있어요.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={handleContinue}
            className="rounded-full bg-purple-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500"
          >
            {returnIntent?.label ?? "계속하기"}
          </button>
          <Link
            href="/"
            onClick={clearPaymentReturnIntent}
            className="rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/35 hover:text-white"
          >
            홈으로
          </Link>
        </div>
      </main>
    </div>
  );
}
