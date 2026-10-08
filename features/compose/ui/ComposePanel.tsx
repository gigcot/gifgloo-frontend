"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { requestCreditBalanceRefresh } from "@/features/credits/model/use-credits";
import { GifSearchSheet } from "@/features/gif-search/ui/GifSearchSheet";
import { setPaymentReturnIntent } from "@/shared/lib/payment-return";
import { CompletionNotificationButton } from "./CompletionNotificationButton";
import { DownloadIcon, ImageIcon, PlusIcon, UpdateIcon } from "@radix-ui/react-icons";
import { FrameHelp, FrameStatus } from "@/features/gif-search/ui/GifFrameInfo";
import { inspectGifFrames, useSelectedGifFrame } from "@/features/gif-search/model/use-gif-frames";
import { submitCompositionFeedback } from "@/features/compose/model/composition-feedback-api";
import { trackEvent, trackEventOnce } from "@/shared/lib/umami";
import { beginCompositionAttempt, journeyContext } from "@/shared/lib/journey";
import { ObservedResultImage } from "@/shared/ui/ObservedResultImage";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/features/auth/model/signup-consent";
import { isSupportedImageFile } from "@/features/compose/model/prepare-image-upload";
import {
  refreshExp001SurveyStatus,
  useExp001SurveyStatus,
} from "@/features/experiment/model/exp-001-survey";
import { requestExp001SurveyOpen } from "@/features/experiment/model/exp-001-survey-open";

type Stage = "ready" | "processing" | "done" | "error";
type RetrySource = "completed" | "failed";

type CompositionWait = {
  initialSeconds: number | null;
  confirmed: boolean;
  openedAt: number;
};

export function ComposePanel() {
  const router = useRouter();
  const { authFetch, userId, isAnonymous, hasUserSession, consentRequired, ensureSession, refreshAuth } = useAuth();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [consent, setConsent] = useState({ age: false, terms: false, privacy: false });
  const consentReady = !consentRequired || (consent.age && consent.terms && consent.privacy);
  const survey = useExp001SurveyStatus();

  const [stage, setStage] = useState<Stage>("ready");
  const [gif, setGif] = useState<Gif | null>(null);
  const [restoredInput, setRestoredInput] = useState(false);
  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [showInsufficientPass, setShowInsufficientPass] = useState(false);
  const [showGifSheet, setShowGifSheet] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [compositionWait, setCompositionWait] = useState<CompositionWait | null>(null);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showSurveyReminder, setShowSurveyReminder] = useState(false);
  const [evaluateSurveyReminder, setEvaluateSurveyReminder] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const composingRef = useRef(false);
  const retrySourceRef = useRef<RetrySource | null>(null);
  const refreshedSurveyJobRef = useRef<string | null>(null);
  const previousRequestRef = useRef<{ gifId: string | number; file: File } | null>(null);
  const lastConsentStateRef = useRef<string | null>(null);

  const job = useCompositionJob(jobId);
  const frame = useSelectedGifFrame(gif);

  const prepareSession = useCallback(async () => {
    setSessionError(null);
    try { await ensureSession(); }
    catch (error) { setSessionError(error instanceof Error ? error.message : "체험 준비에 실패했어요."); }
  }, [ensureSession]);

  // 서버 세션 준비와 인증 저장소 동기화는 합성 화면 진입 시 필요하다.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void prepareSession(); }, [prepareSession]);

  useEffect(() => {
    if (restoredInput) trackEventOnce(`compose:${journeyContext().flow_id}:${Boolean(gif)}`, "compose_viewed", { gif_restored: Boolean(gif) });
  }, [restoredInput, gif]);

  useEffect(() => {
    if (gif && photoFile) trackEvent("compose_inputs_ready");
  }, [gif, photoFile]);

  useEffect(() => {
    if (!hasUserSession) return;
    const state = `${userId}:${consentRequired}:${consentReady}`;
    if (lastConsentStateRef.current === state) return;
    lastConsentStateRef.current = state;
    trackEvent("compose_consent_state", { required: consentRequired, ready: consentReady });
  }, [userId, hasUserSession, consentRequired, consentReady]);

  const setPhotoFromFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPhotoFile(file);
    setMyPhoto(url);
    trackEvent("photo_uploaded", { file_type: file.type || "unknown" });
    trackEvent("photo_selected", { file_type: file.type || "unknown" });
  }, []);

  // 홈에서 선택한 GIF를 합성 화면으로 전달한다.
  useEffect(() => {
    const saved = localStorage.getItem("compose_gif");
    const restoredGif = saved ? safeParseGif(saved) : null;
    const timer = window.setTimeout(() => {
      if (restoredGif) setGif(restoredGif);
      setRestoredInput(true);
      if (saved && localStorage.getItem("compose_gif") === saved) localStorage.removeItem("compose_gif");
    }, 0);
    return () => window.clearTimeout(timer);
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
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      const heading = mainRef.current?.querySelector<HTMLElement>("h1");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    });
    return () => cancelAnimationFrame(timer);
  }, [visibleStage]);
  useEffect(() => {
    const input = fileInputRef.current;
    const cancelled = () => trackEvent("photo_picker_cancelled");
    input?.addEventListener("cancel", cancelled);
    return () => input?.removeEventListener("cancel", cancelled);
  }, [visibleStage]);
  const visibleError = job.isFailed ? job.failedReason : error;
  useEffect(() => {
    if (
      !job.isComplete ||
      !jobId ||
      !userId ||
      refreshedSurveyJobRef.current === jobId
    ) {
      return;
    }
    refreshedSurveyJobRef.current = jobId;
    void refreshExp001SurveyStatus(authFetch, userId);
  }, [authFetch, job.isComplete, jobId, userId]);

  useEffect(() => {
    if (!evaluateSurveyReminder || !userId) return;
    if (survey.status === "idle" || survey.status === "loading") return;

    // 비동기 설문 조회가 끝나면 브라우저별 1회 노출 상태를 동기화한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvaluateSurveyReminder(false);
    if (survey.status !== "done" || !survey.eligible || survey.submitted) return;

    const reminderKey = `exp001_survey_reminder_seen:${userId}`;
    if (localStorage.getItem(reminderKey)) return;
    localStorage.setItem(reminderKey, "true");
    setShowSurveyReminder(true);
    trackEvent("exp001_survey_reminder_shown");
  }, [evaluateSurveyReminder, survey, userId]);

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
    trackEvent("photo_removed");
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

    if (!isSupportedImageFile(file)) {
      trackEvent("photo_rejected", { reason: "unsupported_type" });
      setFileError("이미지 파일만 업로드할 수 있어요 (JPG, PNG, WebP, HEIC)");
      e.target.value = "";
      return;
    }

    setFileError(null);
    setPhotoFromFile(file);
    e.target.value = "";
  }

  async function handleCompose(confirmed = false) {
    if (!gif || !photoFile || !consentReady) return;
    if (composingRef.current) return;
    composingRef.current = true;

    setStage("processing");
    setError(null);
    setConfirmation(null);

    try {
      await ensureSession();
      if (consentRequired) {
        trackEvent("compose_consent_save", { status: "started" });
        let response: Response;
        try {
          response = await authFetch(`${API_BASE}/users/me/consents`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ terms_version: CURRENT_TERMS_VERSION, privacy_version: CURRENT_PRIVACY_VERSION, is_fourteen_or_older: consent.age }),
          });
        } catch (error) {
          trackEvent("compose_consent_save", { status: "error", reason: "network" });
          throw error;
        }
        trackEvent("compose_consent_save", { status: response.ok ? "success" : "error", http_status: response.status });
        if (!response.ok) throw new Error("이용 동의를 저장하지 못했어요. 다시 시도해 주세요.");
        await refreshAuth();
      }
    } catch (error) {
      composingRef.current = false;
      setStage("ready");
      setSessionError(error instanceof Error ? error.message : "체험 준비에 실패했어요.");
      return;
    }

    const result = await submitComposition(authFetch, gif, photoFile, confirmed);

    if (result.type === "job") {
      requestCreditBalanceRefresh();
      trackEvent("composition_requested", { job_id: result.jobId });
      if (retrySourceRef.current) {
        trackEvent("composition_retried", {
          job_id: result.jobId,
          from_status: retrySourceRef.current,
          same_gif: previousRequestRef.current?.gifId === gif.id,
          same_photo: previousRequestRef.current?.file === photoFile,
          survey_state: survey.status === "done" ? survey.submitted ? "submitted" : "not_submitted" : "unknown",
        });
        retrySourceRef.current = null;
      }
      previousRequestRef.current = { gifId: gif.id, file: photoFile };
      setJobId(result.jobId);
    } else if (result.type === "confirmation") {
      composingRef.current = false;
      trackEvent("composition_frame_confirmation", { action: "opened" });
      setConfirmation(result.confirmation);
      setStage("ready");
    } else if (result.type === "auth_required") {
      composingRef.current = false;
      setStage("ready");
      setSessionError("접속 상태를 다시 확인해 주세요. 선택한 GIF와 사진은 유지돼요.");
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

  function cancelFrameConfirmation(method: "button" | "backdrop") {
    trackEvent("composition_frame_confirmation", { action: "cancelled", method });
    setConfirmation(null);
  }

  function handleReset(source: RetrySource) {
    trackEvent(
      source === "completed"
        ? "composition_restart_clicked"
        : "composition_retry_clicked",
      jobId ? { job_id: jobId } : undefined,
    );
    retrySourceRef.current = source;
    if (source === "completed" && userId) {
      setEvaluateSurveyReminder(true);
      void refreshExp001SurveyStatus(authFetch, userId);
    }
    composingRef.current = false;
    setStage("ready");
    setError(null);
    setConfirmation(null);
    setFileError(null);
    setCompositionWait(null);
    setWaitSeconds(null);
    setJobId(null);
    setFeedbackSubmitted(false);
    setFeedbackSubmitting(false);
    setFeedbackError(null);
  }

  async function handleFeedback(satisfied: boolean) {
    if (!jobId || feedbackSubmitting || feedbackSubmitted) return;

    setFeedbackSubmitting(true);
    setFeedbackError(null);

    try {
      await submitCompositionFeedback(authFetch, jobId, satisfied);
      trackEvent("composition_feedback_submitted", { satisfied, job_id: jobId });
      setFeedbackSubmitted(true);
    } catch {
      setFeedbackError("응답을 저장하지 못했어요. 다시 눌러주세요.");
    } finally {
      setFeedbackSubmitting(false);
    }
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
    <main ref={mainRef}>

      {/* ── 준비 상태 ── */}
      {visibleStage === "ready" && (
        <div className={`compose-content${myPhoto ? " has-photo" : ""}`}>
          <h1>어떤 사진을 넣어볼까요?</h1>
          <p className="compose-guidance">대상이 잘 보이는 사진을 골라주세요.</p>
          {!hasUserSession && !sessionError && <p role="status" className="text-sm text-white/50">체험을 준비하고 있어요. 먼저 사진을 골라도 좋아요.</p>}
          {sessionError && <div role="alert" className="text-sm text-red-300">
            <p>{sessionError}</p><button onClick={() => void prepareSession()} className="mt-2 underline">접속 다시 확인</button>
          </div>}
          {showSurveyReminder && !(survey.status === "done" && survey.submitted) && (
            <div
              role="status"
              className="flex flex-col gap-3 rounded-2xl border border-purple-400/25 bg-purple-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-bold text-purple-100">
                  설문에 참여하면 사용횟수 1회를 드려요.
                </p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  지급 후 7일 동안 사용할 수 있어요.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setShowSurveyReminder(false)}
                  className="rounded-full px-3 py-2 text-xs font-semibold text-white/45 hover:text-white"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSurveyReminder(false);
                    requestExp001SurveyOpen();
                  }}
                  className="rounded-full bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500"
                >
                  설문 참여하기
                </button>
              </div>
            </div>
          )}
          <div className="compose-gif">
            {gif && <img src={getGifUrl(gif, "md")} alt="selected gif" />}
            <div><p>선택한 GIF</p><h2>{gif?.title || "GIF를 골라주세요"}</h2>
              {gif && <div className="selected-frame"><FrameStatus frame={frame} /><FrameHelp count={frame?.status === "ready" ? frame.count : undefined} compact />
                {frame?.status === "error" && <button className="frame-retry" onClick={() => inspectGifFrames(gif, true)}>다시 확인</button>}
              </div>}
            </div>
            <button className="text-action" onClick={() => setShowGifSheet(true)}>{gif ? "바꾸기" : "GIF 고르기"}</button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" aria-label="합성할 사진" />
          {myPhoto ? <>
            <div className="photo-heading-row"><h2>넣은 사진</h2><div className="photo-actions">
              <button className="text-action" onClick={() => { trackEvent("photo_change_clicked"); fileInputRef.current?.click(); }}>바꾸기</button>
              <span aria-hidden="true">|</span><button className="text-action" onClick={clearPhoto}>삭제</button>
            </div></div>
            <div className="photo-preview"><img src={myPhoto} alt="my photo"
              onLoad={() => trackEvent("photo_preview_loaded")} onError={() => trackEvent("photo_preview_failed")} /></div>
          </> : <div className="photo-empty"><ImageIcon aria-hidden="true" /><button className="photo-pick"
              onClick={() => { trackEvent("photo_picker_opened"); fileInputRef.current?.click(); }}>사진 고르기</button></div>}
          {fileError && <p className="photo-error" role="alert">{fileError}</p>}
          <Link href="/privacy" target="_blank" className="text-action photo-policy">사진 처리 안내</Link>
          {consentRequired && <fieldset className="consent-inline">
            <legend className="px-1">처음 이용할 때 한 번 확인해요</legend>
            <label className="consent-all"><input type="checkbox" checked={consent.age && consent.terms && consent.privacy}
              onChange={event => setConsent({ age: event.target.checked, terms: event.target.checked, privacy: event.target.checked })} />전체 동의</label>
            <label><input type="checkbox" checked={consent.age} onChange={event => setConsent({ ...consent, age: event.target.checked })} />[필수] 만 14세 이상</label>
            <label><input type="checkbox" checked={consent.terms} onChange={event => setConsent({ ...consent, terms: event.target.checked })} /><span>[필수] <Link href="/terms" target="_blank">이용약관</Link> 동의</span></label>
            <label><input type="checkbox" checked={consent.privacy} onChange={event => setConsent({ ...consent, privacy: event.target.checked })} /><span>[필수] <Link href="/privacy" target="_blank">개인정보처리방침</Link> 동의</span></label>
          </fieldset>}
          <div className="compose-submit">
            <button onClick={() => { beginCompositionAttempt(); trackEvent("compose_clicked"); void handleCompose(); }}
              disabled={!myPhoto || !gif || !hasUserSession || !consentReady} className="make-button">만들기</button>
            <p>{isAnonymous ? "무료 1회 사용" : "1회 사용"} · 약 2~3분</p>
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
              {isAnonymous ? "지금 만든 결과는 계속 저장하거나 공유할 수 있어요. 설문 참여 대상이라면 응답 후 1회를 더 받을 수 있어요. 가입해도 무료 횟수가 다시 지급되지는 않아요." : <>합성을 시작하려면 GIF 합성 이용권이 필요합니다.<br />5회 이용권을 구매하시겠어요?</>}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowInsufficientPass(false)}
                className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
              >
                나중에
              </button>
              {!isAnonymous && <button
                onClick={goPurchaseFromCompose}
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500"
              >
                이용권 구매
              </button>}
              {isAnonymous && survey.status === "done" && survey.eligible && !survey.submitted && <button
                onClick={() => { setShowInsufficientPass(false); requestExp001SurveyOpen(); }}
                className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white">설문 참여하기</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── 프레임 초과 확인 모달 ── */}
      {confirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => cancelFrameConfirmation("backdrop")}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-[#111113] p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-base font-bold text-white">{confirmation.message}</p>
            <div className="flex gap-2">
              <button
                onClick={() => cancelFrameConfirmation("button")}
                className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
              >
                취소
              </button>
              <button
                onClick={() => { trackEvent("composition_frame_confirmation", { action: "confirmed" }); setConfirmation(null); handleCompose(true); }}
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

      {visibleStage === "processing" && (
        <div className="waiting-content">
          <div className="waiting-materials">
            {gif && <img src={getGifUrl(gif, "md")} alt="선택한 GIF" />}
            <PlusIcon aria-hidden="true" />{myPhoto && <img src={myPhoto} alt="my photo" />}
          </div>
          <UpdateIcon className="waiting-spinner" aria-hidden="true" />
          <h1 aria-live="polite">{jobId ? "GIF를 만들고 있어요" : "사진을 보내고 있어요"}</h1>
          <p className="waiting-estimate">{jobId ? "약 2~3분 걸려요" : "접수가 끝날 때까지 이 화면을 유지해주세요."}</p>
          {job.connectionLost && <p role="status" className="mt-4 px-4 text-sm text-white/70">진행 상태를 다시 연결하고 있어요. 접수된 작업은 ‘내 결과’에서도 확인할 수 있어요.</p>}
          {jobId && <><CompletionNotificationButton key={jobId} jobId={jobId} />
            <p className="waiting-return">다른 화면을 보고 와도 괜찮아요.<br />이 브라우저의 ‘내 결과’에서 확인할 수 있어요.</p>
          </>}
        </div>
      )}

      {visibleStage === "done" && job.resultUrl && (
        <div className="completed-content">
          <h1>완성됐어요!</h1>
          <div className="completed-media">
            <ObservedResultImage src={job.resultUrl} jobId={jobId!} assetId={job.resultAssetId!} source="composition_result" className="w-full object-contain" />
          </div>
          <div className="result-actions">
            <button className="result-save" disabled={!job.resultAssetId} onClick={() => {
              if (job.resultAssetId) downloadGif(`${API_BASE}/assets/${job.resultAssetId}/download`, "composition_result", job.resultAssetId);
            }}><DownloadIcon aria-hidden="true" />GIF 저장</button>
            <ShareButton assetId={job.resultAssetId ?? undefined} analyticsSource="composition_result" className="result-copy" />
          </div>
          <button className="result-redo" onClick={() => handleReset("completed")}><UpdateIcon aria-hidden="true" />다시 만들기</button>
          <section className="result-feedback" aria-labelledby="rating-title">
            <h2 id="rating-title">{feedbackSubmitted ? "평가해 주셔서 감사해요" : "결과는 어땠나요?"}</h2>
            {!feedbackSubmitted && <div className="rating-options" role="group" aria-labelledby="rating-title">
              <button disabled={feedbackSubmitting} onClick={() => void handleFeedback(false)}>아쉬워요</button>
              <button disabled={feedbackSubmitting} onClick={() => void handleFeedback(true)}>만족해요</button>
            </div>}
            {feedbackError && <p role="alert" className="mt-3 text-sm text-red-300">{feedbackError}</p>}
          </section>
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
            onClick={() => handleReset("failed")}
            className="rounded-full border border-white/20 px-8 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            다시 시도
          </button>
        </div>
      )}
    </main>

    {showGifSheet && (
      <GifSearchSheet
        onSelect={(selected) => { trackEvent("gif_selection_changed", { action: gif ? "changed" : "selected", source: "compose_search" }); setGif(selected); setShowGifSheet(false); }}
        onClose={() => setShowGifSheet(false)}
      />
    )}

    </>
  );
}
