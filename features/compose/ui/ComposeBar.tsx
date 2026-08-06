"use client";

import { useRef } from "react";
import type { Gif } from "@/entities/gif/model";
import { getGifUrl } from "@/entities/gif/model";
import { setPendingPhoto } from "@/features/compose/model/pending-photo";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

type Props = {
  selectedGif: Gif | null;
  onCompose: () => void;
};

export function ComposeBar({ selectedGif, onCompose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return;
    setPendingPhoto(file);
    onCompose();
  }

  return (
    <div
      className={`pointer-events-none fixed bottom-4 left-0 right-0 z-50 px-4 transition-transform duration-300 ${
        selectedGif ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="pointer-events-auto mx-auto flex max-w-4xl items-center gap-3 rounded-2xl border border-white/10 bg-[#0f0f12]/95 p-2 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        {selectedGif && (
          <div className="hidden items-center gap-3 sm:flex">
            <img
              src={getGifUrl(selectedGif, "xs")}
              alt="selected"
              className="h-14 w-20 rounded-lg border border-white/10 bg-black object-cover"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-purple-200">GIF 선택됨</p>
              <p className="max-w-[220px] truncate text-sm text-white/55">{selectedGif.title}</p>
            </div>
          </div>
        )}
        <div className="flex flex-1 items-center gap-2">
          {selectedGif && (
            <img
              src={getGifUrl(selectedGif, "xs")}
              alt="selected"
              className="h-11 w-14 rounded-md border border-white/10 bg-black object-cover sm:hidden"
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
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] py-2.5 text-sm font-semibold text-white/75 transition-colors hover:border-purple-400/70 hover:bg-purple-500/10 hover:text-white sm:text-base"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            사진 올리기
          </button>
          <button
            onClick={() => onCompose()}
            className="rounded-full bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-purple-500 sm:px-7 sm:text-base"
          >
            합성하기
          </button>
        </div>
      </div>
    </div>
  );
}
