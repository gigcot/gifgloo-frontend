"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ScenePreset } from "../model/scene-presets";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function ScenePreview({ scene }: { scene: ScenePreset }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  useEffect(() => {
    if (reducedMotion) ref.current?.pause();
    else void ref.current?.play().catch((error: DOMException) => {
      if (error.name !== "NotAllowedError" && error.name !== "AbortError") setFailed(true);
    });
  }, [reducedMotion]);
  return <>
    <video ref={ref} src={`/examples/scenes/${scene.id}.mp4`} poster={`/examples/scenes/${scene.id}.webp`} muted loop playsInline preload="metadata" aria-label={scene.title} onError={() => setFailed(true)} />
    {failed && <span role="status">미리보기를 재생하지 못했어요.</span>}
  </>;
}
