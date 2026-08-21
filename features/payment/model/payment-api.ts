"use client";

import { API_BASE } from "@/shared/lib/api-base";

export type PaymentProduct = {
  id: string;
  name: string;
  amount: number;
  credit_amount: number;
  purpose: "COMPOSITION_PASS_PURCHASE";
  usage_count: number;
  validity_days: number;
  currency: string;
};

export type PaymentCheckout = {
  payment_id: string;
  order_id: string;
  amount: number;
  credit_amount: number;
  purpose: "COMPOSITION_PASS_PURCHASE";
  currency: string;
  status: string;
  order_name: string;
};

export type PaymentCompletion = {
  payment_id: string;
  status: string;
  already_processed: boolean;
  test_payment: boolean;
};

export async function fetchPaymentProducts(authFetch: typeof fetch): Promise<PaymentProduct[]> {
  const res = await authFetch(`${API_BASE}/payments/products`, {
    method: "GET",
  });
  if (!res.ok) throw new Error("결제 상품을 불러오지 못했습니다");

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("결제 상품 응답이 올바르지 않습니다");

  return data.map((item) => {
    if (
      typeof item.id !== "string" ||
      typeof item.name !== "string" ||
      typeof item.amount !== "number" ||
      typeof item.credit_amount !== "number" ||
      item.purpose !== "COMPOSITION_PASS_PURCHASE" ||
      typeof item.usage_count !== "number" ||
      typeof item.validity_days !== "number" ||
      typeof item.currency !== "string"
    ) {
      throw new Error("결제 상품 응답이 올바르지 않습니다");
    }
    return item;
  });
}

export async function createPaymentCheckout(
  authFetch: typeof fetch,
  productId: string,
): Promise<PaymentCheckout> {
  const res = await authFetch(`${API_BASE}/payments/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId }),
  });
  if (!res.ok) throw new Error("결제창을 만들지 못했습니다");

  const data = await res.json();
  if (
    typeof data.payment_id !== "string" ||
    typeof data.order_id !== "string" ||
    typeof data.amount !== "number" ||
    typeof data.credit_amount !== "number" ||
    data.purpose !== "COMPOSITION_PASS_PURCHASE" ||
    typeof data.currency !== "string" ||
    typeof data.status !== "string" ||
    typeof data.order_name !== "string"
  ) {
    throw new Error("결제창 응답이 올바르지 않습니다");
  }

  return data;
}

export async function completePortOnePayment(
  authFetch: typeof fetch,
  paymentId: string,
): Promise<PaymentCompletion> {
  const res = await authFetch(`${API_BASE}/payments/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_id: paymentId }),
  });
  if (!res.ok) throw new Error("결제 완료 정보를 확인하지 못했습니다");

  const data = await res.json();
  if (
    typeof data.payment_id !== "string" ||
    typeof data.status !== "string" ||
    typeof data.already_processed !== "boolean" ||
    typeof data.test_payment !== "boolean"
  ) {
    throw new Error("결제 완료 응답이 올바르지 않습니다");
  }
  return data;
}
