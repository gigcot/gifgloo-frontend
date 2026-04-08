"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Gif } from "@/entities/gif/model";
import { getGifUrl, safeParseGif } from "@/entities/gif/model";
import { useAuth } from "@/shared/lib/use-auth";
import { useCompositionJob } from "@/features/compose/model/use-composition-job";
import { takePendingPhoto } from "@/features/compose/model/pending-photo";
import { submitComposition } from "@/features/compose/model/compose-api";
import type { Confirmation } from "@/features/compose/model/compose-api";
import { ShareButton } from "@/shared/ui/ShareButton";
import { GifSearchSheet } from "@/features/gif-search/ui/GifSearchSheet";

type Stage = "ready" | "processing" | "done" | "error";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function ComposePanel() {
  const router = useRouter();
  const { authFetch } = useAuth();

  const [stage, setStage] = useState<Stage>("ready");
  const [gif, setGif] = useState<Gif | null>(null);
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [showGifSheet, setShowGifSheet] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const composingRef = useRef(false);

  const job = useCompositionJob(jobId);

  // GIF 복원 (로그인 전 선택 → 로그인 후 자동 진입)
  useEffect(() => {
    const saved = localStorage.getItem("compose_gif");
    if (!saved) return;
    const gif = safeParseGif(saved);
    if (gif) setGif(gif);
    localStorage.removeItem("compose_gif");
  }, []);

  // 메인 페이지 ComposeBar에서 사진 올리기로 진입한 경우
  useEffect(() => {
    const file = takePendingPhoto();
    if (file) setPhotoFromFile(file);
  }, []);

  // object URL 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  // 잡 완료 → done 전환
  useEffect(() => {
    if (job.isComplete) setStage("done");
  }, [job.isComplete]);

  // 잡 실패 → error 전환
  useEffect(() => {
    if (job.isFailed) {
      setError(job.failedReason);
      setStage("error");
    }
  }, [job.isFailed, job.failedReason]);

  function setPhotoFromFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPhotoFile(file);
    setMyPhoto(url);
  }

  function clearPhoto() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPhotoFile(null);
    setMyPhoto(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setFileError("이미지 파일만 업로드할 수 있어요 (JPG, PNG, WebP, HEIC)");
      e.target.value = "";
      return;
    }

    setFileError(null);
    setPhotoFromFile(file);
  }

  async function handleCompose(confirmed = false) {
    if (!gif || !photoFile) return;
    if (composingRef.current) return;
    composingRef.current = true;

    setStage("processing");
    setError(null);
    setConfirmation(null);

    const result = await submitComposition(authFetch, gif, photoFile, confirmed);

    if (result.type === "job") {
      setJobId(result.jobId);
    } else if (result.type === "confirmation") {
      setConfirmation(result.confirmation);
      setStage("ready");
    } else if (result.type === "auth_required") {
      localStorage.setItem("pending_gif", JSON.stringify(gif));
      localStorage.setItem("pending_action", "compose");
      router.push("/");
    } else {
      setError(result.message);
      setStage("error");
    }
  }

  function handleReset() {
    clearPhoto();
    setStage("ready");
    setError(null);
    setConfirmation(null);
    setFileError(null);
    setJobId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <>
    <main className="mx-auto max-w-screen-xl px-4 py-6">

      {/* ── 준비 상태 ── */}
      {stage === "ready" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            {/* 선택한 GIF */}
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-xs font-semibold text-white/40">선택한 GIF</p>
              <button
                onClick={() => setShowGifSheet(true)}
                className="aspect-square w-full overflow-hidden rounded-2xl bg-white/5 transition-colors hover:bg-white/10"
              >
                {gif ? (
                  <img src={getGifUrl(gif, "md")} alt="selected gif" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-white/60">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-white/50">GIF 검색</p>
                  </div>
                )}
              </button>
            </div>

            {/* + 아이콘 */}
            <div className="flex items-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/40">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>

            {/* 내 사진 */}
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
                    onClick={clearPhoto}
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

          {fileError && (
            <p className="text-center text-sm text-red-400">{fileError}</p>
          )}

          <button
            onClick={() => setShowCreditConfirm(true)}
            disabled={!myPhoto || !gif}
            className="w-full rounded-full bg-purple-600 py-4 text-base font-bold text-white transition-all hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            합성하기
          </button>
        </div>
      )}

      {/* ── 합성 시작 크레딧 안내 모달 ── */}
      {showCreditConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowCreditConfirm(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-[#1a1a1a] p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-base font-bold text-white">합성을 시작할까요?</p>
            <p className="text-center text-sm text-white/50">
              합성 작업 시작 시 크레딧이 차감되며<br />AI는 정확하지 않을 수 있습니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreditConfirm(false)}
                className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
              >
                취소
              </button>
              <button
                onClick={() => { setShowCreditConfirm(false); handleCompose(); }}
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-700"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 프레임 초과 확인 모달 ── */}
      {confirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmation(null)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-[#1a1a1a] p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-base font-bold text-white">{confirmation.message}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmation(null)}
                className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
              >
                취소
              </button>
              <button
                onClick={() => { setConfirmation(null); handleCompose(true); }}
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-700"
              >
                네, 진행할게요
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 처리 중 ── */}
      {stage === "processing" && (
        <div className="flex flex-col items-center gap-8 py-16">
          {/* GIF + 내 사진 미리보기 */}
          <div className="flex items-center gap-3">
            <div className="h-28 w-28 overflow-hidden rounded-2xl ring-2 ring-purple-500/40">
              {gif && <img src={getGifUrl(gif, "md")} alt="gif" className="h-full w-full object-cover" />}
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

          {/* 진행 바 */}
          <div className="w-full max-w-xs">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-purple-500 transition-[width] duration-700 ease-out"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>

          <p className="text-sm text-white/40">{job.statusMessage}</p>
        </div>
      )}

      {/* ── 완료 ── */}
      {stage === "done" && job.resultUrl && (
        <div className="flex flex-col items-center gap-6">
          <div className="w-full overflow-hidden rounded-2xl">
            <img src={job.resultUrl} alt="합성 결과" className="w-full object-cover" />
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => {
                if (!job.resultUrl) return;
                const a = document.createElement("a");
                a.href = job.resultUrl;
                a.download = `gifgloo_${Date.now()}.gif`;
                a.click();
              }}
              className="w-full rounded-full bg-purple-600 py-4 text-base font-bold text-white transition-colors hover:bg-purple-700"
            >
              저장하기
            </button>
            <div className="flex gap-2">
              <ShareButton
                url={job.resultUrl!}
                shareUrl={job.resultAssetId ? `${window.location.origin}/result/${job.resultAssetId}` : undefined}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
              />
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

      {/* ── 에러 ── */}
      {stage === "error" && (
        <div className="flex flex-col items-center gap-6 py-16">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={handleReset}
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            다시 시도
          </button>
        </div>
      )}
    </main>

    {showGifSheet && (
      <GifSearchSheet
        onSelect={(selected) => { setGif(selected); setShowGifSheet(false); }}
        onClose={() => setShowGifSheet(false)}
      />
    )}
    </>
  );
}
