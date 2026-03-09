"use client";

import type { Gif } from "@/entities/gif/model";

type Props = {
  selectedGif: Gif | null;
  onCompose: () => void;
};

export function ComposeBar({ selectedGif, onCompose }: Props) {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#1a1a1a]/95 px-4 py-3 backdrop-blur-md transition-transform duration-300 ${
        selectedGif ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-screen-xl items-center gap-3">
        {selectedGif && (
          <img
            src={selectedGif.url}
            alt="selected"
            className="h-12 w-16 rounded-md object-cover"
          />
        )}
        <div className="flex flex-1 items-center gap-2">
          <button className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-base font-medium text-white/70 transition-colors hover:border-purple-500 hover:text-white">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            사진 올리기
          </button>
          <button
            onClick={onCompose}
            className="rounded-full bg-purple-600 px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-purple-700"
          >
            합성하기
          </button>
        </div>
      </div>
    </div>
  );
}
