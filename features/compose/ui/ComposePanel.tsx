"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Gif } from "@/entities/gif/model";
import { getGifUrl, safeParseGif } from "@/entities/gif/model";
import { useAuth } from "@/shared/lib/use-auth";
import { useCompositionJob } from "@/features/compose/model/use-composition-job";
import { clearPendingPhoto, getPendingPhoto } from "@/features/compose/model/pending-photo";
import { submitComposition } from "@/features/compose/model/compose-api";
import type { Confirmation } from "@/features/compose/model/compose-api";
import { ShareButton } from "@/shared/ui/ShareButton";
import { API_BASE } from "@/shared/lib/api-base";
import { downloadGif } from "@/shared/lib/download";
import { GifSearchSheet } from "@/features/gif-search/ui/GifSearchSheet";
import { setPaymentReturnIntent } from "@/shared/lib/payment-return";
import { fetchCreditBalance } from "@/features/credits/model/use-credits";
import { CompositionFeedbackModal } from "@/features/compose/ui/CompositionFeedbackModal";
import { trackEvent } from "@/shared/lib/umami";

type Stage = "ready" | "processing" | "done" | "error";

type UsageSnapshot = {
  before: number;
  after: number | null;
};

type CompositionWait = {
  initialSeconds: number | null;
  confirmed: boolean;
  openedAt: number;
};

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
  const [showUsageConfirm, setShowUsageConfirm] = useState(false);
  const [showInsufficientPass, setShowInsufficientPass] = useState(false);
  const [showGifSheet, setShowGifSheet] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [usageSnapshot, setUsageSnapshot] = useState<UsageSnapshot | null>(null);
  const [compositionWait, setCompositionWait] = useState<CompositionWait | null>(null);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const composingRef = useRef(false);
  const feedbackPromptedJobRef = useRef<string | null>(null);

  const job = useCompositionJob(jobId);

  const setPhotoFromFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPhotoFile(file);
    setMyPhoto(url);
    trackEvent("photo_uploaded", { file_type: file.type || "unknown" });
  }, []);

  // GIF 복원 (로그인 전 선택 → 로그인 후 자동 진입)
  useEffect(() => {
    const saved = localStorage.getItem("compose_gif");
    if (!saved) return;
    const gif = safeParseGif(saved);
    if (gif) {
      const timer = window.setTimeout(() => {
        setGif(gif);
        if (localStorage.getItem("compose_gif") === saved) {
          localStorage.removeItem("compose_gif");
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }
    localStorage.removeItem("compose_gif");
  }, []);

  // 메인 페이지 ComposeBar에서 사진 올리기로 진입한 경우
  useEffect(() => {
    let cancelled = false;

    getPendingPhoto().then((file) => {
      if (cancelled || !file) return;
      setPhotoFromFile(file);
      void clearPendingPhoto(file);
    });

    return () => {
      cancelled = true;
    };
  }, [setPhotoFromFile]);

  // object URL 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const visibleStage = job.isComplete ? "done" : job.isFailed ? "error" : stage;
  const visibleError = job.isFailed ? job.failedReason : error;
  const displayedUsesBefore = job.creditSettlement
    ? Math.floor(job.creditSettlement.balanceBefore / 10)
    : usageSnapshot?.before ?? null;
  const displayedUsesAfter = job.creditSettlement
    ? Math.floor(job.creditSettlement.balanceAfter / 10)
    : usageSnapshot?.after ?? null;

  useEffect(() => {
    if ((visibleStage !== "done" && visibleStage !== "error") || !usageSnapshot || usageSnapshot.after !== null) return;

    let cancelled = false;
    fetchCreditBalance(authFetch)
      .then((balance) => {
        if (cancelled) return;
        setUsageSnapshot((current) => current ? { ...current, after: balance.remainingUses } : current);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [authFetch, usageSnapshot, visibleStage]);

  useEffect(() => {
    if (!job.isComplete || !jobId || feedbackPromptedJobRef.current === jobId) return;

    feedbackPromptedJobRef.current = jobId;
    const timer = window.setTimeout(() => {
      trackEvent("composition_feedback_opened");
      setShowFeedback(true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [job.isComplete, jobId]);

  useEffect(() => {
    if (!compositionWait || compositionWait.initialSeconds === null) return;

    const deadline = compositionWait.openedAt + compositionWait.initialSeconds * 1000;
    const updateRemaining = () => {
      setWaitSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timer);
  }, [compositionWait]);

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

    try {
      const balance = await fetchCreditBalance(authFetch);
      setUsageSnapshot({ before: balance.remainingUses, after: null });
    } catch {
      setUsageSnapshot(null);
    }

    const result = await submitComposition(authFetch, gif, photoFile, confirmed);

    if (result.type === "job") {
      trackEvent("composition_requested");
      setJobId(result.jobId);
    } else if (result.type === "confirmation") {
      composingRef.current = false;
      setConfirmation(result.confirmation);
      setStage("ready");
    } else if (result.type === "auth_required") {
      localStorage.setItem("pending_gif", JSON.stringify(gif));
      localStorage.setItem("pending_action", "compose");
      router.push("/");
    } else if (result.type === "insufficient_credit") {
      composingRef.current = false;
      setStage("ready");
      setShowInsufficientPass(true);
    } else if (result.type === "composition_unavailable") {
      composingRef.current = false;
      setStage("ready");
      setCompositionWait({
        initialSeconds: result.retryAfterSeconds,
        confirmed,
        openedAt: Date.now(),
      });
      setWaitSeconds(result.retryAfterSeconds);
    } else {
      composingRef.current = false;
      setError(result.message);
      setStage("error");
    }
  }

  function handleReset() {
    composingRef.current = false;
    clearPhoto();
    setStage("ready");
    setError(null);
    setConfirmation(null);
    setFileError(null);
    setUsageSnapshot(null);
    setCompositionWait(null);
    setWaitSeconds(null);
    setJobId(null);
    setShowFeedback(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function goPurchaseFromCompose() {
    if (gif) {
      localStorage.setItem("compose_gif", JSON.stringify(gif));
    }
    setPaymentReturnIntent({
      href: "/compose",
      label: "합성 계속하기",
    });
    router.push("/payment/charge");
  }

  return (
    <>
    <main className="mx-auto max-w-screen-xl px-4 py-6">

      {/* ── 준비 상태 ── */}
      {visibleStage === "ready" && (
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 rounded-3xl border border-white/10 bg-[#111113] p-3 shadow-2xl sm:p-4">
            {/* 선택한 GIF */}
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-xs font-semibold text-white/45">선택한 GIF</p>
              <button
                onClick={() => setShowGifSheet(true)}
                className="aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black transition-colors hover:border-purple-400/50"
              >
                {gif ? (
                  <img src={getGifUrl(gif, "md")} alt="selected gif" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/40">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>

            {/* 내 사진 */}
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-xs font-semibold text-white/45">내 사진</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {myPhoto ? (
                <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black">
                  <img src={myPhoto} alt="my photo" className="h-full w-full object-cover" />
                  <button
                    onClick={clearPhoto}
                    className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/70 p-1 text-white backdrop-blur-sm hover:bg-black"
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-black transition-colors hover:border-purple-400/60 hover:bg-purple-500/10"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
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
            onClick={() => setShowUsageConfirm(true)}
            disabled={!myPhoto || !gif}
            className="w-full rounded-full bg-purple-600 py-4 text-base font-bold text-white shadow-lg shadow-purple-950/40 transition-all hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
          >
            합성하기
          </button>
        </div>
      )}

      {/* ── 합성 이용권 사용 안내 모달 ── */}
      {showUsageConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowUsageConfirm(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-[#111113] p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-base font-bold text-white">이용권 1회를 사용할까요?</p>
            <p className="text-center text-sm leading-6 text-white/50">
              GIF 합성 이용권 1회가 사용된 뒤<br />AI 합성 작업이 바로 시작됩니다.<br />통상 2~3분 내 결과물이 제공됩니다.
            </p>
            <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-center text-xs leading-5 text-white/45">
              작업 시작 후에는 중도 취소 기능을 제공하지 않으며, 단순 변심에 의한 이용 횟수 복구 및 환불이 제한됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUsageConfirm(false)}
                className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
              >
                취소
              </button>
              <button
                onClick={() => { setShowUsageConfirm(false); handleCompose(); }}
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500"
              >
                시작하기
              </button>
            </div>
          </div>
        </div>
      )}

      {showInsufficientPass && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setShowInsufficientPass(false)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-[#111113] p-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-center text-base font-bold text-white">사용 가능한 이용권이 없어요</p>
            <p className="text-center text-sm leading-6 text-white/50">
              합성을 시작하려면 GIF 합성 이용권이 필요합니다.<br />5회 이용권을 구매하시겠어요?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInsufficientPass(false)}
                className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
              >
                나중에
              </button>
              <button
                onClick={goPurchaseFromCompose}
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500"
              >
                이용권 구매
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
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-[#111113] p-8 shadow-2xl"
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
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500"
              >
                네, 진행할게요
              </button>
            </div>
          </div>
        </div>
      )}

      {compositionWait && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
          onClick={() => setCompositionWait(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="composition-wait-title"
            className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-purple-300/20 bg-[#141217] p-7 shadow-[0_24px_100px_rgba(88,28,135,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-purple-500/20 blur-3xl" />
            <div className="relative flex flex-col items-center text-center">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full p-[5px] shadow-[0_0_36px_rgba(168,85,247,0.2)]"
                style={{
                  background: compositionWait.initialSeconds && waitSeconds !== null
                    ? `conic-gradient(#a855f7 ${(waitSeconds / compositionWait.initialSeconds) * 360}deg, rgba(255,255,255,0.08) 0deg)`
                    : "rgba(168,85,247,0.18)",
                }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#171419]">
                  {waitSeconds !== null ? (
                    <>
                      <span className="text-3xl font-black tabular-nums text-white">{waitSeconds}</span>
                      <span className="text-[11px] font-semibold text-purple-300">초 남음</span>
                    </>
                  ) : (
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-300">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  )}
                </div>
              </div>

              <h2 id="composition-wait-title" className="mt-6 text-xl font-bold text-white">
                {waitSeconds === 0 ? "이제 합성을 시작할 수 있어요" : "조금만 기다려 주세요"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                {waitSeconds === null
                  ? "현재 다른 합성 작업을 처리하고 있어요. 잠시 후 다시 시도해 주세요."
                  : waitSeconds === 0
                    ? "대기 시간이 끝났어요. 아래 버튼을 눌러 다시 시작해 주세요."
                    : "안정적인 합성을 위해 다음 요청까지 잠시 쉬어가고 있어요."}
              </p>

              <button
                onClick={() => {
                  if (waitSeconds !== 0) return;
                  const confirmed = compositionWait.confirmed;
                  setCompositionWait(null);
                  void handleCompose(confirmed);
                }}
                disabled={waitSeconds !== 0}
                className="mt-6 w-full rounded-full bg-purple-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-purple-950/40 transition-all hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-white/[0.07] disabled:text-white/30 disabled:shadow-none"
              >
                {waitSeconds === null
                  ? "잠시 후 다시 시도해 주세요"
                  : waitSeconds === 0
                    ? "다시 합성하기"
                    : `${waitSeconds}초 후 다시 시도`}
              </button>
              <button
                onClick={() => setCompositionWait(null)}
                className="mt-3 px-4 py-2 text-xs font-medium text-white/40 transition-colors hover:text-white/70"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 처리 중 ── */}
      {visibleStage === "processing" && (
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
      {visibleStage === "done" && job.resultUrl && (
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
          <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
            <img src={job.resultUrl} alt="합성 결과" className="w-full object-contain" />
          </div>

          {displayedUsesBefore !== null && (
            <div className="grid w-full grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#111113] p-4 text-center">
              <div>
                <p className="text-xs text-white/40">사용 전</p>
                <p className="mt-1 font-bold text-white">{displayedUsesBefore.toLocaleString()}회</p>
              </div>
              <div className="border-x border-white/10">
                <p className="text-xs text-white/40">이번 합성</p>
                <p className="mt-1 font-bold text-purple-300">-1회</p>
              </div>
              <div>
                <p className="text-xs text-white/40">남은 이용권</p>
                <p className="mt-1 font-bold text-white">
                  {displayedUsesAfter === null ? "확인 중" : `${displayedUsesAfter.toLocaleString()}회`}
                </p>
              </div>
            </div>
          )}

          <div className="flex w-full flex-col gap-3">
            <button
              onClick={() => job.resultAssetId && downloadGif(
                `${API_BASE}/assets/${job.resultAssetId}/download`,
                "composition_result",
              )}
              disabled={!job.resultAssetId}
              className="w-full rounded-full bg-purple-600 py-4 text-base font-bold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-purple-500"
            >
              다운로드
            </button>
            <div className="flex gap-2">
              <ShareButton
                assetId={job.resultAssetId ?? undefined}
                analyticsSource="composition_result"
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/35 hover:text-white"
              />
              <button
                onClick={handleReset}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/35 hover:text-white"
              >
                다시 만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 에러 ── */}
      {visibleStage === "error" && (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-16 text-center">
          <div>
            <h2 className="text-lg font-bold text-white">작업에 실패했습니다</h2>
            <p className="mt-2 text-sm text-red-300">{visibleError}</p>
          </div>
          {job.creditRestored && (
            <div className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="font-semibold text-emerald-200">사용한 이용권 1회가 복구되었습니다.</p>
              <p className="mt-2 text-xs leading-5 text-white/45">
                원 이용권이 이미 만료된 경우 복구된 1회는 복구 시점부터 24시간 동안 사용할 수 있습니다.
              </p>
            </div>
          )}
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

    {showFeedback && jobId && job.resultUrl && (
      <CompositionFeedbackModal
        authFetch={authFetch}
        compositionJobId={jobId}
        resultUrl={job.resultUrl}
        onClose={() => setShowFeedback(false)}
      />
    )}
    </>
  );
}
