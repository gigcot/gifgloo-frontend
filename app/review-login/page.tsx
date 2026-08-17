"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { API_BASE } from "@/shared/lib/api-base";
import { Header } from "@/shared/ui/Header";

export default function ReviewLoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !loginId || !password) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/oauth/review-login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: loginId, password }),
      });

      if (!response.ok) {
        setError("아이디 또는 비밀번호를 확인해주세요.");
        return;
      }

      router.replace("/payment/charge");
    } catch {
      setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header title="심사용 로그인" showBack />
      <main className="mx-auto flex max-w-md px-4 py-16 sm:py-24">
        <section className="w-full rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl sm:p-8">
          <p className="text-sm font-semibold text-purple-300">PG REVIEW</p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">전자결제 심사용 로그인</h1>
          <p className="mt-3 text-sm leading-6 text-white/50">
            전자결제 서비스 심사 담당자에게 전달된 전용 계정으로 로그인해주세요.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-semibold text-white/75">아이디</span>
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={loginId}
                onChange={(event) => setLoginId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition-colors placeholder:text-white/25 focus:border-purple-400/60"
                placeholder="심사용 아이디"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-white/75">비밀번호</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white outline-none transition-colors placeholder:text-white/25 focus:border-purple-400/60"
                placeholder="심사용 비밀번호"
                required
              />
            </label>

            {error && (
              <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !loginId || !password}
              className="w-full rounded-xl bg-purple-600 px-4 py-3 font-bold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
