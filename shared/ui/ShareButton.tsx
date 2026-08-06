"use client";

import { useState } from "react";
import { API_BASE } from "@/shared/lib/api-base";
import { copyShareUrl } from "@/shared/lib/share";
import { useAuth } from "@/shared/lib/use-auth";

interface Props {
  shareUrl?: string;
  assetId?: string;
  className?: string;
}

export function ShareButton({ shareUrl, assetId, className }: Props) {
  const { authFetch } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  async function getShareUrl(): Promise<string> {
    if (shareUrl) return shareUrl;
    if (!assetId) throw new Error("공유할 결과가 없습니다");

    const res = await authFetch(`${API_BASE}/assets/${assetId}/share`, { method: "POST" });
    if (!res.ok) throw new Error("공유 링크를 만들지 못했습니다");

    const data = await res.json();
    if (typeof data.share_token !== "string") {
      throw new Error("공유 링크 응답이 올바르지 않습니다");
    }
    return `${window.location.origin}/result/${data.share_token}`;
  }

  async function handleShare() {
    try {
      await copyShareUrl(await getShareUrl());
      setMessage("링크 복사됨");
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setMessage("공유하지 못했어요");
      setTimeout(() => setMessage(null), 2000);
    }
  }

  return (
    <button onClick={handleShare} className={className}>
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      {message ?? "링크 복사"}
    </button>
  );
}
