"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CallbackHandler() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] text-white">
      <p>로그인 중...</p>
    </div>
  );
}
