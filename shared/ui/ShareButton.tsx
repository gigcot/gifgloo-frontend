"use client";

import { useState } from "react";
import { Link2Icon } from "@radix-ui/react-icons";
import { API_BASE } from "@/shared/lib/api-base";
import { copyShareUrl } from "@/shared/lib/share";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent } from "@/shared/lib/umami";

interface Props {
  shareUrl?: string;
  assetId?: string;
  jobId?: string;
  className?: string;
  analyticsSource: string;
  iconOnly?: boolean;
  onMessage?: (message: string) => void;
}

export function ShareButton({ shareUrl, assetId, jobId, className, analyticsSource, iconOnly = false, onMessage }: Props) {
  const { authFetch } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function getShareUrl(): Promise<string> {
    if (shareUrl) return shareUrl;
    if (!assetId) throw new Error("공유할 결과가 없습니다");

    const res = await authFetch(`${API_BASE}/assets/${encodeURIComponent(assetId)}/share`, { method: "POST" });
    if (!res.ok) throw new Error("공유 링크를 만들지 못했습니다");

    const data = await res.json();
    if (typeof data.share_token !== "string" || !data.share_token) {
      throw new Error("공유 링크 응답이 올바르지 않습니다");
    }
    return `${window.location.origin}/result/${encodeURIComponent(data.share_token)}`;
  }

  async function handleShare() {
    setBusy(true);
    trackEvent("result_share_attempted", { ...(jobId ? { job_id: jobId } : {}), asset_id: assetId ?? "public_result", source: analyticsSource });
    try {
      await copyShareUrl(getShareUrl());
      trackEvent("result_shared", { ...(jobId ? { job_id: jobId } : {}), method: "link_copy", source: analyticsSource, asset_id: assetId ?? "public_result" });
      setMessage("링크 복사됨");
      onMessage?.("결과 링크를 복사했어요.");
    } catch {
      trackEvent("result_share_failed", { ...(jobId ? { job_id: jobId } : {}), asset_id: assetId ?? "public_result", source: analyticsSource });
      setMessage("공유하지 못했어요");
      onMessage?.("링크를 복사하지 못했어요. 접속 상태와 브라우저의 복사 권한을 확인해주세요.");
    } finally { setBusy(false); }
  }

  return (
    <button type="button" onClick={() => void handleShare()} className={className} disabled={busy} aria-label="링크 복사" title={busy ? "링크 준비 중" : "링크 복사"} aria-busy={busy}>
      <Link2Icon aria-hidden="true" />
      {!iconOnly && <span aria-live="polite">{message ?? "링크 복사"}</span>}
    </button>
  );
}
