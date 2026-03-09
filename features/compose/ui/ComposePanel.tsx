"use client";

import { useState, useRef, useEffect } from "react";
import type { Gif } from "@/entities/gif/model";

type Stage = "ready" | "processing" | "done";

const MOCK_RESULT_URL = "https://picsum.photos/seed/99/400/400";

export function ComposePanel() {
  const [stage, setStage] = useState<Stage>("ready");
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [gif, setGif] = useState<Gif | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("compose_gif");
    if (saved) {
      setGif(JSON.parse(saved));
      localStorage.removeItem("compose_gif");
    }
  }, []);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMyPhoto(URL.createObjectURL(file));
  }

  function handleCompose() {
    setStage("processing");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setStage("done");
          return 100;
        }
        return prev + 4;
      });
    }, 80);
  }

  function handleReset() {
    setStage("ready");
    setMyPhoto(null);
    setProgress(0);
  }

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-6">

      {/* ── 준비 상태 ── */}
      {stage === "ready" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            {/* 왼쪽: 선택한 GIF */}
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-xs font-semibold text-white/40">선택한 GIF</p>
              <div className="aspect-square overflow-hidden rounded-2xl">
                <img src={gif?.url ?? "https://picsum.photos/seed/42/400/300"} alt="selected gif" className="h-full w-full object-cover" />
              </div>
            </div>

            {/* 가운데 + 아이콘 */}
            <div className="flex items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/40">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>

            {/* 오른쪽: 내 사진 */}
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-xs font-semibold text-white/40">내 사진</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {myPhoto ? (
                <div className="relative aspect-square overflow-hidden rounded-2xl">
                  <img src={myPhoto} alt="my photo" className="h-full w-full object-cover" />
                  <button
                    onClick={() => setMyPhoto(null)}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white backdrop-blur-sm hover:bg-black/80"
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 transition-colors hover:border-purple-500/60 hover:bg-purple-600/5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-white/60">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white/50">사진 올리기</p>
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleCompose}
            disabled={!myPhoto}
            className="w-full rounded-full bg-purple-600 py-4 text-base font-bold text-white transition-all hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            합성하기
          </button>
        </div>
      )}

      {/* ── 처리 중 ── */}
      {stage === "processing" && (
        <div className="flex flex-col items-center gap-8 py-16">
          <div className="relative flex items-center justify-center gap-3">
            <div className="h-28 w-28 overflow-hidden rounded-2xl ring-2 ring-purple-500/40">
              <img src={gif?.url ?? "https://picsum.photos/seed/42/400/300"} alt="gif" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="h-0.5 w-8 animate-pulse rounded-full bg-purple-500" />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="animate-spin text-purple-400">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <div className="h-0.5 w-8 animate-pulse rounded-full bg-purple-500" />
            </div>
            <div className="h-28 w-28 overflow-hidden rounded-2xl ring-2 ring-purple-500/40">
              {myPhoto && <img src={myPhoto} alt="my photo" className="h-full w-full object-cover" />}
            </div>
          </div>

          <div className="w-full max-w-xs">
            <div className="mb-2 flex justify-between text-sm text-white/50">
              <span>합성 중...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-purple-500 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-white/30">잠깐만요, AI가 열심히 합성하고 있어요</p>
        </div>
      )}

      {/* ── 완료 ── */}
      {stage === "done" && (
        <div className="flex flex-col items-center gap-6">
          <div className="w-full overflow-hidden rounded-2xl">
            <img src={MOCK_RESULT_URL} alt="result" className="w-full object-cover" />
          </div>

          <div className="flex w-full flex-col gap-3">
            <button className="w-full rounded-full bg-purple-600 py-4 text-base font-bold text-white transition-colors hover:bg-purple-700">
              저장하기
            </button>
            <div className="flex gap-2">
              <button className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                공유하기
              </button>
              <button
                onClick={handleReset}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
              >
                다시 만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
