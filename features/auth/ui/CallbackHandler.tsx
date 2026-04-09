"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const isNewUser = searchParams.get("is_new_user");
    if (isNewUser === "true") {
      sessionStorage.setItem("is_new_user", "true");
    }
    router.replace("/");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] text-white">
      <p>로그인 중...</p>
    </div>
  );
}
