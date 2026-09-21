"use client";

import type { Gif } from "@/entities/gif/model";

type Props = {
  selectedGif: Gif | null;
  onCompose: () => void;
};

export function ComposeBar({ selectedGif, onCompose }: Props) {
  return (
    <div
      aria-hidden={!selectedGif}
      inert={!selectedGif}
      className={`fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-0 right-0 z-50 px-4 transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none ${
        selectedGif
          ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-[calc(100%+3rem)] scale-[0.98] opacity-0"
      }`}
    >
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#0f0f12]/95 p-2 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <button
          onClick={() => onCompose()}
          className="w-full rounded-xl bg-purple-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-purple-500"
        >
          합성하기
        </button>
      </div>
    </div>
  );
}
