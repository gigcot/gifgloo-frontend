"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { completePortOnePayment } from "@/features/payment/model/payment-api";
import { Header } from "@/shared/ui/Header";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent, trackEventOnce } from "@/shared/lib/umami";

export default function PortOneReturnPage() {
  const { authFetch } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const paymentId = params.get("paymentId");
      const code = params.get("code");
      const message = params.get("message");

      if (code) {
        trackEvent("payment_canceled", {
          source: "payment_redirect",
          provider_code: code,
        });
        setError(message ?? "결제가 취소되었거나 실패했습니다.");
        return;
      }
      if (!paymentId) {
        trackEvent("payment_failed", {
          source: "payment_redirect",
          stage: "missing_payment_id",
        });
        setError("결제번호를 확인할 수 없습니다.");
        return;
      }

      completePortOnePayment(authFetch, paymentId)
        .then((completion) => {
          trackEventOnce(
            `payment-completed:${completion.payment_id}`,
            "payment_completed",
            {
              test_payment: completion.test_payment,
              source: "payment_redirect",
            },
          );
          window.location.replace(
            completion.test_payment
              ? "/payment/success?test=true"
              : "/payment/success",
          );
        })
        .catch((caught) => {
          trackEvent("payment_failed", {
            source: "payment_redirect",
            stage: "completion_verification",
          });
          setError(
            caught instanceof Error
              ? caught.message
              : "결제 완료 정보를 확인하지 못했습니다.",
          );
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [authFetch]);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header title="결제 확인" />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        {error ? (
          <>
            <p className="text-sm font-semibold text-red-300">payment failed</p>
            <h1 className="mt-3 text-2xl font-bold">결제를 확인하지 못했어요</h1>
            <p className="mt-4 text-sm leading-6 text-white/50">{error}</p>
            <Link
              href="/payment/charge"
              className="mt-8 inline-block rounded-full bg-purple-600 px-6 py-3 text-sm font-bold hover:bg-purple-500"
            >
              다시 시도하기
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-purple-300">checking payment</p>
            <h1 className="mt-3 text-2xl font-bold">결제 결과를 확인하고 있어요</h1>
            <p className="mt-4 text-sm text-white/45">이 화면을 닫지 말고 잠시 기다려주세요.</p>
          </>
        )}
      </main>
    </div>
  );
}
