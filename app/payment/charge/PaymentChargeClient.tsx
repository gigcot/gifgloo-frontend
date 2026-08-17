"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import * as PortOne from "@portone/browser-sdk/v2";
import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import { useCredits } from "@/features/credits/model/use-credits";
import { useAuth } from "@/shared/lib/use-auth";
import {
  completePortOnePayment,
  createPaymentCheckout,
  fetchPaymentProducts,
  type PaymentProduct,
} from "@/features/payment/model/payment-api";

type State =
  | { status: "loading" }
  | { status: "ready"; products: PaymentProduct[] }
  | { status: "error"; message: string };

const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

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
  const { authFetch, email } = useAuth();
  const credits = useCredits();
  const [state, setState] = useState<State>({ status: "loading" });
  const [checkoutProductId, setCheckoutProductId] = useState<string | null>(null);
  const [previewProductId, setPreviewProductId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const normalizedPhone = customerPhone.replace(/[^0-9]/g, "");
  const canRequestPayment = Boolean(
    customerName.trim()
      && normalizedPhone.length >= 10
      && normalizedPhone.length <= 11
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim()),
  );

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

  useEffect(() => {
    if (email) {
      setCustomerEmail((current) => current || email);
    }
  }, [email]);

  async function handleCheckout(productId: string) {
    if (checkoutProductId) return;
    if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
      setCheckoutError("포트원 결제 채널이 설정되지 않았습니다");
      return;
    }
    if (!canRequestPayment) {
      setCheckoutError("결제자 이름, 연락처와 이메일을 모두 입력해주세요");
      return;
    }

    setCheckoutProductId(productId);
    setCheckoutError("");
    try {
      const checkout = await createPaymentCheckout(authFetch, productId);
      const paymentResponse = await PortOne.requestPayment({
        storeId: PORTONE_STORE_ID,
        channelKey: PORTONE_CHANNEL_KEY,
        paymentId: checkout.order_id,
        orderName: checkout.order_name,
        totalAmount: checkout.amount,
        currency: "KRW",
        payMethod: "CARD",
        customer: {
          fullName: customerName.trim(),
          phoneNumber: normalizedPhone,
          email: customerEmail.trim(),
        },
        redirectUrl: `${window.location.origin}/payment/portone-return`,
      });
      if (paymentResponse === undefined) {
        setCheckoutProductId(null);
        return;
      }
      if (paymentResponse.code !== undefined) {
        throw new Error(paymentResponse.message ?? "결제가 취소되었습니다");
      }

      const completion = await completePortOnePayment(
        authFetch,
        paymentResponse.paymentId,
      );
      window.location.assign(
        completion.test_payment ? "/payment/success?test=true" : "/payment/success",
      );
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "결제창을 만들지 못했습니다",
      );
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

        <section className="mt-6 rounded-2xl border border-purple-400/20 bg-purple-500/[0.06] p-5 text-sm leading-6 text-white/60">
          <p className="font-semibold text-white">현재 제공 중인 서비스</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>업로드한 사진 1장과 선택한 GIF를 AI로 합성해 새로운 GIF 결과물을 제작합니다.</li>
            <li>OpenAI GPT Image 1.5 기반 기술을 사용하며, 작업 1회에 10크레딧이 사용됩니다.</li>
            <li>GIF는 최대 20프레임으로 처리되며, 작업은 통상 2~3분 소요됩니다.</li>
            <li>완료된 결과물은 내 에셋에서 확인, 다운로드 및 공유할 수 있습니다.</li>
            <li>결과물 수정 기능은 현재 제공하지 않습니다.</li>
          </ul>
          <Link href="/service-guide" className="mt-3 inline-block font-semibold text-purple-200 underline underline-offset-4 hover:text-white">
            서비스·이용 기준 자세히 보기
          </Link>
        </section>

        <section className="mt-8">
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#111113] p-5">
            <p className="font-semibold text-white">결제자 정보</p>
            <p className="mt-1 text-xs leading-5 text-white/40">
              KG이니시스 카드 결제창 호출에 필요한 정보입니다.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-white/55">이름</span>
                <input
                  type="text"
                  autoComplete="name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-purple-400/60"
                  placeholder="홍길동"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-white/55">휴대전화</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-purple-400/60"
                  placeholder="010-1234-5678"
                  required
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-white/55">이메일</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-purple-400/60"
                  placeholder="buyer@example.com"
                  required
                />
              </label>
            </div>
          </div>

          {checkoutError && (
            <p
              role="alert"
              className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {checkoutError}
            </p>
          )}

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
                      {checkoutProductId === product.id ? "결제창 여는 중" : "신용카드로 결제"}
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
          <p className="mt-3">
            결제 전 <Link href="/terms" className="underline hover:text-white">이용약관</Link>, <Link href="/privacy" className="underline hover:text-white">개인정보처리방침</Link>, <Link href="/refund" className="underline hover:text-white">결제 및 환불정책</Link>, <Link href="/credits-policy" className="underline hover:text-white">크레딧 정책</Link>을 확인해주세요.
          </p>
        </div>
      </main>
    </div>
  );
}
