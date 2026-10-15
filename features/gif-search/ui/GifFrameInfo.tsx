"use client";
import { useEffect, useRef } from "react";
import { QuestionMarkCircledIcon, UpdateIcon } from "@radix-ui/react-icons";
import { type GifFrame } from "../model/use-gif-frames";
export function FrameStatus({ frame, compact = false }: { frame?: GifFrame; compact?: boolean }) {
  if (!frame) return null;
  return <span className={`frame-status ${frame.status}${compact ? " compact" : ""}`} role="status" aria-live="polite" aria-atomic="true">
    {frame.status === "loading" ? <><UpdateIcon className="frame-spinner" aria-hidden="true" /><span>{compact ? "확인 중" : "프레임 확인 중…"}</span></>
      : frame.status === "ready" ? `${frame.count}프레임`
      : compact ? "확인 불가" : "프레임 확인 못함"}
  </span>;
}

export function FrameHelp({ count, compact = false }: { count?: number; compact?: boolean }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: Event) {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (event.type === "keydown" && event instanceof KeyboardEvent && event.key === "Escape") {
        details.open = false;
        details.querySelector("summary")?.focus();
      } else if (event.type === "pointerdown" && !details.contains(event.target as Node)) details.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, []);
  return <details ref={detailsRef} className={`frame-help${compact ? " compact" : ""}`}>
    <summary aria-label="GIF 선택 도움말"><QuestionMarkCircledIcon aria-hidden="true" />{!compact && <span>선택 팁</span>}</summary>
    <div className="frame-help-content">
      {compact && Number.isInteger(count) ? <>
        <strong>이 GIF는 {count}프레임이에요</strong>
        <p>{count! > 20 ? "이 중 20프레임을 골라 합성해요." : "모든 프레임을 사용해 합성해요."}</p>
      </> : <>
        <strong>GIF 고르는 팁</strong>
        <p>20프레임 안팎이거나 그보다 적은 GIF를 추천해요.<br />프레임이 많으면 일부만 골라 합성해요.</p>
      </>}
    </div>
  </details>;
}
