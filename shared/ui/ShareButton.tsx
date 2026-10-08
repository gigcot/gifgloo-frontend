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
  className?: string;
  analyticsSource: string;
}

export function ShareButton({ shareUrl, assetId, className, analyticsSource }: Props) {
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
    trackEvent("result_share_attempted", { asset_id: assetId ?? "public_result", source: analyticsSource });
    try {
      await copyShareUrl(await getShareUrl());
      trackEvent("result_shared", {
        method: "link_copy",
        source: analyticsSource,
        asset_id: assetId ?? "public_result",
      });
      setMessage("링크 복사됨");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      trackEvent("result_share_failed", { asset_id: assetId ?? "public_result", source: analyticsSource });
      setMessage("공유하지 못했어요");
      setTimeout(() => setMessage(null), 2000);
    }
  }

  return (
    <button onClick={() => void handleShare()} className={className}>
      <Link2Icon aria-hidden="true" />
      {message ?? "링크 복사"}
    </button>
  );
}
