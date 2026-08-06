"use client";

export type PaymentReturnIntent = {
  href: string;
  label: string;
};

const PAYMENT_RETURN_KEY = "gifgloo_payment_return";

function isSafeInternalHref(href: unknown): href is string {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
}

export function setPaymentReturnIntent(intent: PaymentReturnIntent) {
  if (typeof window === "undefined") return;
  if (!isSafeInternalHref(intent.href)) return;
  sessionStorage.setItem(PAYMENT_RETURN_KEY, JSON.stringify(intent));
}

export function getPaymentReturnIntent(): PaymentReturnIntent | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(PAYMENT_RETURN_KEY);
  if (!raw) return null;

  let parsed: Partial<PaymentReturnIntent>;
  try {
    parsed = JSON.parse(raw) as Partial<PaymentReturnIntent>;
  } catch {
    clearPaymentReturnIntent();
    return null;
  }

  if (!isSafeInternalHref(parsed.href) || typeof parsed.label !== "string") return null;

  return {
    href: parsed.href,
    label: parsed.label,
  };
}

export function clearPaymentReturnIntent() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PAYMENT_RETURN_KEY);
}

export function currentPathForPaymentReturn() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}
