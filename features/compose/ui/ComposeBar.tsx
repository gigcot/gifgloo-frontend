"use client";

import { useRef } from "react";
import type { Gif } from "@/entities/gif/model";
import { GifMedia } from "@/entities/gif/ui/GifMedia";
import { setPendingPhoto } from "@/features/compose/model/pending-photo";
import { isSupportedImageFile } from "@/features/compose/model/prepare-image-upload";

type Props = {
  selectedGif: Gif | null;
  onCompose: () => void;
};

export function ComposeBar({ selectedGif, onCompose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isSupportedImageFile(file)) return;
    await setPendingPhoto(file);
    onCompose();
  }

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
      <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-2xl border border-white/10 bg-[#0f0f12]/95 p-2 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {selectedGif && (
          <div className="hidden items-center gap-3 sm:flex">
            <GifMedia
              gif={selectedGif}
              size="xs"
              alt="selected"
              eager
              containerClassName="h-14 w-20 shrink-0 rounded-lg border border-white/10 bg-black"
              className="h-full w-full object-cover"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-purple-200">GIF 선택됨</p>
              <p className="max-w-[220px] truncate text-sm text-white/55">{selectedGif.title}</p>
            </div>
          </div>
        )}
        <div className="flex flex-1 items-center gap-2">
          {selectedGif && (
            <GifMedia
              gif={selectedGif}
              size="xs"
              alt="selected"
              eager
              containerClassName="h-11 w-14 shrink-0 rounded-md border border-white/10 bg-black sm:hidden"
              className="h-full w-full object-cover"
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-purple-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-purple-500 sm:text-base"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            사진 올리기
          </button>
          <button
            onClick={() => onCompose()}
            className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/75 transition-colors hover:border-purple-400/70 hover:bg-purple-500/10 hover:text-white sm:px-7 sm:text-base"
          >
            합성하기
          </button>
        </div>
      </div>
    </div>
  );
}
