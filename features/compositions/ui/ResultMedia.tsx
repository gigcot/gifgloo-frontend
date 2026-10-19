"use client";

import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Film, LoaderCircle, Pause, Play, RotateCcw, Share, X } from "lucide-react";
import { API_BASE } from "@/shared/lib/api-base";
import { downloadGif } from "@/shared/lib/download";
import { recordFirstResult } from "@/shared/lib/journey";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent, trackEventOnce } from "@/shared/lib/umami";
import { ShareButton } from "@/shared/ui/ShareButton";
import { decodeResult, downloadResultFile, encodeResultMp4, releaseResult, type DecodedResult } from "../lib/result-media";
import styles from "./ResultMedia.module.css";

type Props = {
  src: string;
  assetId: string;
  jobId: string;
  source: "composition_result" | "my_assets" | "notification_return";
  onRestart?: () => void;
};

function IconButton({ label, className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} className={`${styles.icon} ${className}`} {...props}>{children}</button>;
}

export function ResultMedia(props: Props) {
  const { userId } = useAuth();
  const [attempt, setAttempt] = useState(0);
  if (!userId) return null;
  return <OwnedResultMedia key={`${userId}:${props.assetId}:${props.src}:${attempt}`} {...props} onRetry={() => setAttempt(value => value + 1)} />;
}

function OwnedResultMedia({ src, assetId, jobId, source, onRestart, onRetry }: Props & { onRetry: () => void }) {
  const { authFetch } = useAuth();
  const [gif, setGif] = useState<DecodedResult | null>(null);
  const [gifFile, setGifFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [frameMode, setFrameMode] = useState(false);
  const [format, setFormat] = useState<"GIF" | "MP4">("GIF");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mp4File, setMp4File] = useState<File | null>(null);
  const [conversion, setConversion] = useState({ progress: 0, error: "" });
  const [convertAttempt, setConvertAttempt] = useState(0);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState("");
  const mediaRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const indexRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const formatButtonRef = useRef<HTMLButtonElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stripRef = useRef<HTMLDivElement>(null);
  const formatsId = useId();
  const framesId = useId();
  const downloadUrl = `${API_BASE}/assets/${encodeURIComponent(assetId)}/download`;

  useEffect(() => {
    const controller = new AbortController();
    let decoded: DecodedResult | undefined;
    void (async () => {
      const response = await authFetch(`${API_BASE}/assets/${encodeURIComponent(assetId)}/content`, {
        signal: controller.signal, cache: "no-store", redirect: "error",
      });
      if (!response.ok) throw new Error("결과 파일을 불러오지 못했어요. 접속 상태를 확인하고 다시 시도해주세요.");
      const blob = await response.blob();
      controller.signal.throwIfAborted();
      const file = new File([blob], "gifgloo-result.gif", { type: "image/gif" });
      setGifFile(file);
      decoded = await decodeResult(file, controller.signal);
      setGif(decoded);
    })().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoadError(error instanceof Error ? error.message : "결과를 준비하지 못했어요. 다시 시도해주세요.");
        trackEvent("result_export_load_failed", { job_id: jobId, asset_id: assetId, source });
      }
    });
    return () => { controller.abort(); if (decoded) releaseResult(decoded); };
  }, [assetId, authFetch, jobId, source]);

  useEffect(() => {
    const media = mediaRef.current;
    const img = imageRef.current;
    if (!media) return;
    let inView = false;
    const check = () => {
      if (!inView || document.visibilityState !== "visible" || (!gif && (!img?.complete || !img.naturalWidth))) return;
      recordFirstResult();
      trackEventOnce(`result_viewed:${jobId}:${source}`, "composition_result_viewed", { job_id: jobId, asset_id: assetId, source });
    };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; check(); });
    observer.observe(media);
    img?.addEventListener("load", check);
    document.addEventListener("visibilitychange", check);
    return () => { observer.disconnect(); img?.removeEventListener("load", check); document.removeEventListener("visibilitychange", check); };
  }, [gif, jobId, assetId, source]);

  useEffect(() => {
    if (!gif) return;
    const context = canvasRef.current?.getContext("2d");
    context?.clearRect(0, 0, gif.previewWidth, gif.previewHeight);
    context?.drawImage(gif.frames[frameIndex].bitmap, 0, 0);
    indexRef.current = frameIndex;
  }, [gif, frameIndex]);

  useEffect(() => {
    if (!gif || frameMode || (paused ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    let index = indexRef.current;
    let deadline = performance.now() + gif.frames[index].delay;
    const loopDuration = gif.frames.reduce((duration, frame) => duration + frame.delay, 0);
    let request: number;
    const tick = (now: number) => {
      if (now >= deadline) {
        deadline += Math.floor((now - deadline) / loopDuration) * loopDuration;
        do {
          index = (index + 1) % gif.frames.length;
          deadline += gif.frames[index].delay;
        } while (now >= deadline);
        setFrameIndex(index);
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [gif, paused, frameMode]);

  useEffect(() => {
    if (!frameMode) return;
    const thumb = thumbRefs.current[frameIndex];
    const strip = stripRef.current;
    if (thumb && strip) strip.scrollTo({ left: thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2, behavior: "instant" });
  }, [frameIndex, frameMode]);

  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { setMenuOpen(false); formatButtonRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);

  useEffect(() => {
    if (format !== "MP4" || !gif || mp4File) return;
    const controller = new AbortController();
    void encodeResultMp4(gif, progress => {
      if (!controller.signal.aborted) setConversion({ progress, error: "" });
    }, controller.signal).then(file => {
      if (!controller.signal.aborted) setMp4File(file);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setConversion({ progress: 0, error: error instanceof Error ? error.message : "MP4 변환에 실패했어요. GIF로 저장해주세요." });
        trackEvent("result_mp4_conversion_failed", { job_id: jobId, asset_id: assetId, source });
      }
    });
    return () => controller.abort();
  }, [format, gif, mp4File, convertAttempt, assetId, jobId, source]);

  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const playing = !(paused ?? reducedMotion);
  const animatedFile = format === "GIF" ? gifFile : mp4File;
  const outputFormat = frameMode ? "PNG" : format;
  const converting = format === "MP4" && !!gif && !mp4File && !conversion.error;

  function selectFrame(index: number, focus = false) {
    setFrameIndex(index);
    if (focus) thumbRefs.current[index]?.focus({ preventScroll: true });
  }

  function handleFrameKey(event: KeyboardEvent) {
    if (!gif) return;
    let next: number | undefined;
    if (event.key === "ArrowRight") next = Math.min(frameIndex + 1, gif.frames.length - 1);
    if (event.key === "ArrowLeft") next = Math.max(frameIndex - 1, 0);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = gif.frames.length - 1;
    if (next !== undefined) { event.preventDefault(); selectFrame(next, true); }
  }

  function save() {
    if (frameMode && gif) {
      trackEvent("result_export_download_attempted", { job_id: jobId, asset_id: assetId, source, format: "png", frame: frameIndex + 1 });
      downloadResultFile(new File([gif.frames[frameIndex].png], `gifgloo-frame-${String(frameIndex + 1).padStart(2, "0")}.png`, { type: "image/png" }));
    } else if (format === "GIF") {
      if (gifFile) {
        trackEvent("result_downloaded", { job_id: jobId, asset_id: assetId, source });
        downloadResultFile(gifFile);
      } else downloadGif(downloadUrl, source, assetId, jobId);
    } else if (mp4File) {
      trackEvent("result_export_download_attempted", { job_id: jobId, asset_id: assetId, source, format: "mp4" });
      downloadResultFile(mp4File);
    }
    setNotice(`${outputFormat} 다운로드를 시작했어요.`);
  }

  async function copyImage() {
    if (!gif) return;
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      setNotice("이 브라우저에서는 이미지 복사를 지원하지 않아요. 옆의 저장 버튼을 이용해주세요."); return;
    }
    setCopying(true);
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": gif.frames[frameIndex].png })]);
      trackEvent("result_image_copied", { job_id: jobId, asset_id: assetId, source, frame: frameIndex + 1 });
      setNotice("이미지를 복사했어요. 원하는 대화에 붙여넣어보세요.");
    } catch {
      setNotice("이미지를 복사하지 못했어요. 복사 권한을 확인하거나 이미지로 저장해주세요.");
    } finally { setCopying(false); }
  }

  async function shareFile() {
    if (!animatedFile) return;
    if (!navigator.share || !navigator.canShare?.({ files: [animatedFile] })) {
      setNotice("이 브라우저에서는 파일 공유를 지원하지 않아요. 저장한 파일을 원하는 앱에서 첨부해주세요."); return;
    }
    setSharing(true);
    trackEvent("result_file_share_attempted", { job_id: jobId, asset_id: assetId, source, format: format.toLowerCase() });
    try {
      await navigator.share({ files: [animatedFile] });
      trackEvent("result_file_share_resolved", { job_id: jobId, asset_id: assetId, source, format: format.toLowerCase() });
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setNotice("공유 창을 열지 못했어요. 파일로 저장한 뒤 첨부해주세요.");
        trackEvent("result_file_share_failed", { job_id: jobId, asset_id: assetId, source, format: format.toLowerCase() });
      }
    } finally { setSharing(false); }
  }

  return <div className={styles.result}>
    <div ref={mediaRef} className={styles.media} style={gif ? { aspectRatio: `${gif.width} / ${gif.height}` } : undefined}>
      {gif ? <canvas ref={canvasRef} width={gif.previewWidth} height={gif.previewHeight} role="img" aria-label={frameMode ? `합성 결과 ${frameIndex + 1}번째 장면` : "합성 결과"} />
        : <img ref={imageRef} src={src} alt="합성 결과" onError={() => { setImageFailed(true); trackEvent("composition_result_load_failed", { job_id: jobId, asset_id: assetId, source }); }} />}
      {!frameMode && <IconButton label={playing ? "재생 일시정지" : "결과 재생"} className={styles.playback} disabled={!gif} onClick={() => setPaused(playing)}>{playing ? <Pause /> : <Play />}</IconButton>}
    </div>
    {imageFailed && !gif && <p className={styles.operation} role="alert">미리보기를 불러오지 못했어요. 아래에서 결과를 저장할 수 있어요.</p>}
    <div className={styles.toolbar} role="group" aria-label="결과 사용하기">
      <div className={styles.format} ref={menuRef}>
        {frameMode ? <span className={styles.formatTag}>PNG</span> : <button type="button" ref={formatButtonRef} className={styles.formatButton} aria-label={`파일 형식 선택, 현재 ${format}`} aria-expanded={menuOpen} aria-controls={formatsId} onClick={() => setMenuOpen(!menuOpen)}>{format}<ChevronDown aria-hidden="true" /></button>}
        {menuOpen && <div className={styles.formatMenu} id={formatsId} role="group" aria-label="파일 형식">
          {(["GIF", "MP4"] as const).map(value => <button type="button" key={value} aria-pressed={format === value} onClick={() => { if (value !== format) { setFormat(value); setConversion({ progress: 0, error: "" }); } setMenuOpen(false); formatButtonRef.current?.focus(); }}>{value}{format === value && <Check aria-hidden="true" />}</button>)}
        </div>}
      </div>
      <div className={styles.iconGroup}>
        {frameMode && <IconButton label="선택한 이미지 복사" className={styles.primary} onClick={() => void copyImage()} disabled={!gif || copying}>{copying ? <LoaderCircle className={styles.spinning} /> : <Copy />}</IconButton>}
        <IconButton label={`${outputFormat} 저장`} className={styles.outlined} disabled={frameMode ? !gif : format === "MP4" && !mp4File} onClick={save}>{!frameMode && converting ? <LoaderCircle className={styles.spinning} /> : <Download />}</IconButton>
        {!frameMode && <IconButton label={`${format} 파일 공유`} className={styles.primary} onClick={() => void shareFile()} disabled={!animatedFile || sharing}>{sharing ? <LoaderCircle className={styles.spinning} /> : <Share />}</IconButton>}
        <IconButton label={frameMode ? "움직이는 결과로 돌아가기" : "한 장 골라 쓰기"} className={frameMode ? styles.selected : ""} aria-expanded={frameMode} aria-controls={framesId} onClick={() => { setMenuOpen(false); setFrameMode(!frameMode); setPaused(!frameMode); }} disabled={!gif}><Film /></IconButton>
        <ShareButton assetId={assetId} jobId={jobId} analyticsSource={source} className={styles.icon} iconOnly onMessage={setNotice} />
      </div>
    </div>
    {!gif && !loadError && <p className={styles.operation} role="status">결과 파일을 준비하고 있어요…</p>}
    {loadError && <div className={`${styles.operation} ${styles.error}`} role="alert">{loadError}<button type="button" onClick={onRetry}>다시 시도</button></div>}
    {!frameMode && converting && <p className={styles.operation} role="status">MP4 변환 중 · {conversion.progress}%</p>}
    {!frameMode && format === "MP4" && conversion.error && <div className={`${styles.operation} ${styles.error}`} role="alert">{conversion.error}<button type="button" onClick={() => { setConversion({ progress: 0, error: "" }); setConvertAttempt(value => value + 1); }}>다시 시도</button></div>}
    {frameMode && gif && <section className={styles.frames} id={framesId} aria-label="장면 선택">
      <div className={styles.frameStrip} ref={stripRef} role="group" aria-label="장면 목록" onKeyDown={handleFrameKey}>
        {gif.frames.map((frame, index) => <button type="button" key={index} ref={element => { thumbRefs.current[index] = element; }} className={index === frameIndex ? styles.active : ""} aria-label={`${index + 1}번째 장면`} aria-pressed={index === frameIndex} tabIndex={index === frameIndex ? 0 : -1} onClick={() => selectFrame(index)}><img src={frame.thumbnailUrl} alt="" /></button>)}
      </div>
      <div className={styles.frameNavigation}>
        <IconButton label="이전 장면" disabled={frameIndex === 0} onClick={() => selectFrame(frameIndex - 1)}><ChevronLeft /></IconButton>
        <span aria-live="polite" aria-atomic="true">{frameIndex + 1} / {gif.frames.length}</span>
        <IconButton label="다음 장면" disabled={frameIndex === gif.frames.length - 1} onClick={() => selectFrame(frameIndex + 1)}><ChevronRight /></IconButton>
      </div>
    </section>}
    {onRestart && <div className={`${styles.restart} ${frameMode ? styles.afterFrames : ""}`}><IconButton label="다시 만들기" onClick={onRestart}><RotateCcw /></IconButton></div>}
    {notice && <div className={styles.notice} role="status"><p>{notice}</p><button type="button" aria-label="알림 닫기" onClick={() => setNotice("")}><X aria-hidden="true" /></button></div>}
  </div>;
}
