import { Suspense } from "react";
import { CallbackHandler } from "@/features/auth/ui/CallbackHandler";

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d0d] text-white">
        <p>로그인 중...</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
