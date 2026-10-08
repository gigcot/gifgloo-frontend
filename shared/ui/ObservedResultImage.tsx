"use client";

import { useEffect, useRef } from "react";
import { trackEvent, trackEventOnce } from "@/shared/lib/umami";
import { recordFirstResult } from "@/shared/lib/journey";

export function ObservedResultImage({ src, jobId, assetId, source, className }: {
  src: string; jobId: string; assetId: string; source: string; className: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    let inView = false;
    const check = () => {
      if (!inView || !img.complete || img.naturalWidth === 0 || document.visibilityState !== "visible") return;
      recordFirstResult();
      trackEventOnce(`result_viewed:${jobId}:${source}`, "composition_result_viewed", { job_id: jobId, asset_id: assetId, source });
    };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; check(); });
    observer.observe(img);
    img.addEventListener("load", check);
    document.addEventListener("visibilitychange", check);
    return () => { observer.disconnect(); img.removeEventListener("load", check); document.removeEventListener("visibilitychange", check); };
  }, [src, jobId, assetId, source]);
  return <img ref={ref} src={src} alt="합성 결과" className={className}
    onError={() => trackEvent("composition_result_load_failed", { job_id: jobId, asset_id: assetId, source })} />;
}
