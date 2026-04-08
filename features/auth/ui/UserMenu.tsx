"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/shared/lib/use-auth";
import { API_BASE } from "@/shared/lib/api-base";

const MENU_ITEMS = [
  { label: "내 에셋", href: "/my-assets" },
  { label: "결제 내역", href: "/coming-soon" },
  { label: "크레딧 충전", href: "/coming-soon" },
  { label: "합성하기", href: "/compose" },
] as const;

export function UserMenu() {
  const router = useRouter();
  const { authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleLogout() {
    await authFetch(`${API_BASE}/auth/logout`, { method: "POST" }).catch(() => {});
    window.location.href = "/";
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white transition-colors hover:bg-purple-700"
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-xl">
          {MENU_ITEMS.map(({ label, href }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); router.push(href); }}
              className="w-full px-4 py-3 text-left text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              {label}
            </button>
          ))}
          <div className="border-t border-white/10" />
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 text-left text-sm font-medium text-red-400 transition-colors hover:bg-white/5"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
