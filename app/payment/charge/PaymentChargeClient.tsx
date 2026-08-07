"use client";

import { useEffect, useState } from "react";
import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import { useCredits } from "@/features/credits/model/use-credits";
import { useAuth } from "@/shared/lib/use-auth";
import {
  createPaymentCheckout,
  fetchPaymentProducts,
  type PaymentProduct,
} from "@/features/payment/model/payment-api";

type State =
  | { status: "loading" }
  | { status: "ready"; products: PaymentProduct[] }
  | { status: "error"; message: string };

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function CreditCountPreview({
  current,
  next,
  active,
}: {
  current: number;
  next: number;
  active: boolean;
}) {
  const [displayed, setDisplayed] = useState(current);

  useEffect(() => {
    if (!active) return;

    const startedAt = performance.now();
    const durationMs = 700;
    let frameId = 0;

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(current + (next - current) * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [active, current, next]);

  const visibleCount = active ? displayed : current;

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs font-semibold text-white/35">충전 후 예상 크레딧</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-2xl font-black tabular-nums text-white">
          {visibleCount.toLocaleString()}
        </span>
        <span className="pb-1 text-sm font-semibold text-purple-200">
          / {next.toLocaleString()} 크레딧
        </span>
      </div>
      <p className="mt-1 text-xs text-white/35">
        현재 {current.toLocaleString()}개에서 {next.toLocaleString()}개로 충전됩니다.
      </p>
    </div>
  );
}

export function PaymentChargeClient() {
  const { authFetch } = useAuth();
  const credits = useCredits();
  const [state, setState] = useState<State>({ status: "loading" });
  const [checkoutProductId, setCheckoutProductId] = useState<string | null>(null);
  const [previewProductId, setPreviewProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentProducts(authFetch)
      .then((products) => setState({ status: "ready", products }))
      .catch((error) => {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "결제 상품을 불러오지 못했습니다",
        });
      });
  }, [authFetch]);

  async function handleCheckout(productId: string) {
    if (checkoutProductId) return;

    setCheckoutProductId(productId);
    try {
      const checkout = await createPaymentCheckout(authFetch, productId);
      window.location.assign(checkout.checkout_page);
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "결제창을 만들지 못했습니다",
      });
      setCheckoutProductId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header title="크레딧 충전" showBack action={<HeaderActions />} />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm font-semibold text-purple-300">credits</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">크레딧 충전</h1>
        <p className="mt-3 text-sm leading-6 text-white/50">
          크레딧은 GIF 합성 작업에 사용됩니다. 결제가 완료되면 계정에 크레딧이 지급됩니다.
        </p>

        <section className="mt-8">
          {state.status === "loading" && (
            <div className="rounded-2xl border border-white/10 bg-[#111113] p-6">
              <div className="h-5 w-32 animate-pulse rounded-full bg-white/10" />
              <div className="mt-4 h-10 animate-pulse rounded-xl bg-white/10" />
            </div>
          )}

          {state.status === "error" && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
              <p className="text-sm font-semibold text-red-300">결제를 준비하지 못했어요</p>
              <p className="mt-2 text-sm text-white/55">{state.message}</p>
            </div>
          )}

          {state.status === "ready" && (
            <div className="grid gap-3">
              {state.products.map((product) => (
                <article
                  key={product.id}
                  onMouseEnter={() => setPreviewProductId(product.id)}
                  onMouseLeave={() => setPreviewProductId(null)}
                  onFocus={() => setPreviewProductId(product.id)}
                  className="rounded-2xl border border-white/10 bg-[#111113] p-5 shadow-2xl"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-bold text-white">{product.name}</p>
                      <p className="mt-1 text-sm text-white/45">
                        {product.credit_amount.toLocaleString()} 크레딧 · {formatPrice(product.amount, product.currency)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCheckout(product.id)}
                      disabled={checkoutProductId !== null}
                      className="rounded-full bg-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-purple-500 disabled:cursor-wait disabled:opacity-50"
                    >
                      {checkoutProductId === product.id ? "결제창 여는 중" : "토스페이로 결제"}
                    </button>
                  </div>
                  {credits.status === "loading" && (
                    <div className="mt-4 h-24 animate-pulse rounded-xl bg-white/10" />
                  )}
                  {credits.status === "done" && (
                    <CreditCountPreview
                      current={credits.balance}
                      next={credits.balance + product.credit_amount}
                      active={previewProductId === product.id || checkoutProductId === product.id}
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-white/45">
          <p>결제 완료 후 크레딧 반영까지 잠시 걸릴 수 있습니다.</p>
        </div>
      </main>
    </div>
  );
}
