"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("is_new_user") === "true") {
      sessionStorage.setItem("is_new_user", "true");
      sessionStorage.setItem("analytics_signup_pending", "true");
    }
    router.replace("/");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] text-white">
      <p>로그인 정보를 확인하고 있어요...</p>
    </div>
  );
}
