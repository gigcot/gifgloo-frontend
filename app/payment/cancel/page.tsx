import Link from "next/link";
import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header title="결제 취소" showBack action={<HeaderActions />} />
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-sm font-semibold text-purple-300">payment canceled</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">결제가 취소됐어요</h1>
        <p className="mt-4 text-sm leading-6 text-white/50">
          결제는 진행되지 않았습니다. 필요하면 다시 크레딧 충전을 시도할 수 있어요.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/payment/charge"
            className="rounded-full bg-purple-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500"
          >
            다시 충전하기
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/35 hover:text-white"
          >
            홈으로
          </Link>
        </div>
      </main>
    </div>
  );
}
