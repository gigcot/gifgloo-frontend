"use client";

import { useState } from "react";
import Link from "next/link";

import type { Gif } from "@/entities/gif/model";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/features/auth/model/signup-consent";
import { API_BASE } from "@/shared/lib/api-base";

type LoginModalProps = {
  onClose: () => void;
  pendingGif?: Gif | null;
};

export function LoginModal({ onClose, pendingGif }: LoginModalProps) {
  const [isFourteenOrOlder, setIsFourteenOrOlder] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canContinue = isFourteenOrOlder && agreedToTerms && agreedToPrivacy;

  async function startSocialLogin(provider: "kakao" | "google") {
    if (!canContinue || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/oauth/${provider}/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms_version: CURRENT_TERMS_VERSION,
          privacy_version: CURRENT_PRIVACY_VERSION,
          is_fourteen_or_older: isFourteenOrOlder,
          agreed_to_terms: agreedToTerms,
          agreed_to_privacy: agreedToPrivacy,
        }),
      });
      if (!response.ok) throw new Error("로그인을 시작하지 못했습니다. 다시 시도해주세요.");
      const { authorization_url }: { authorization_url: string } = await response.json();
      if (pendingGif) {
        localStorage.setItem("pending_gif", JSON.stringify(pendingGif));
      }
      window.location.href = authorization_url;
    } catch {
      setError("로그인을 시작하지 못했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-[#1a1a1a] p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h2 id="login-modal-title" className="text-xl font-bold text-white">로그인 또는 회원가입</h2>
          <p className="mt-2 text-sm leading-6 text-white/50">
            소셜 로그인으로 처음 이용하면<br />gifgloo 회원가입이 함께 진행됩니다.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={isFourteenOrOlder}
              onChange={(event) => setIsFourteenOrOlder(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-purple-500"
            />
            <span><strong className="font-semibold text-purple-300">[필수]</strong> 만 14세 이상입니다.</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(event) => setAgreedToTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-purple-500"
            />
            <span>
              <strong className="font-semibold text-purple-300">[필수]</strong>{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-white"
              >
                이용약관
              </Link>
              에 동의합니다.
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={agreedToPrivacy}
              onChange={(event) => setAgreedToPrivacy(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-purple-500"
            />
            <span>
              <strong className="font-semibold text-purple-300">[필수]</strong>{" "}
              <Link href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">
                개인정보처리방침
              </Link>
              에 동의합니다.
            </span>
          </label>
        </div>

        <button
          onClick={() => void startSocialLogin("kakao")}
          disabled={!canContinue || loading}
          className="flex items-center justify-center gap-3 rounded-xl bg-[#FEE500] px-4 py-3 font-semibold text-[#191919] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.48 3 2 6.48 2 10.8c0 2.7 1.6 5.08 4 6.54L5 21l4.2-2.3c.9.2 1.84.3 2.8.3 5.52 0 10-3.48 10-7.8S17.52 3 12 3z" />
          </svg>
          카카오로 계속하기
        </button>

        <button
          onClick={() => void startSocialLogin("google")}
          disabled={!canContinue || loading}
          className="flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-[#191919] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          구글로 계속하기
        </button>
        {!canContinue && (
          <p className="text-center text-xs text-white/35">필수 항목을 확인하면 소셜 로그인을 진행할 수 있어요.</p>
        )}
        {error && <p role="alert" className="text-center text-xs text-red-300">{error}</p>}
      </div>
    </div>
  );
}
