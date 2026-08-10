"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  clearPendingSignupConsent,
  readPendingSignupConsent,
  recordSignupConsent,
} from "@/features/auth/model/signup-consent";

export function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function finishLogin() {
      const pendingConsent = readPendingSignupConsent();
      if (pendingConsent) {
        try {
          const result = await recordSignupConsent(pendingConsent);
          if (result === "recorded") clearPendingSignupConsent();
        } catch {
          if (!cancelled) setError(true);
          return;
        }
      }

      if (searchParams.get("is_new_user") === "true") {
        sessionStorage.setItem("is_new_user", "true");
      }
      if (!cancelled) router.replace("/");
    }

    void finishLogin();
    return () => {
      cancelled = true;
    };
  }, [retryCount, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] text-white">
      {error ? (
        <div className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-[#171719] p-6 text-center">
          <h1 className="text-lg font-bold">가입 정보를 저장하지 못했습니다</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">잠시 후 다시 시도해주세요.</p>
          <button
            type="button"
            onClick={() => {
              setError(false);
              setRetryCount((count) => count + 1);
            }}
            className="mt-5 w-full rounded-full bg-purple-600 py-3 text-sm font-bold hover:bg-purple-500"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <p>로그인 정보를 확인하고 있어요...</p>
      )}
    </div>
  );
}
