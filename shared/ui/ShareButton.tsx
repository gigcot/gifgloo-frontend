"use client";

import { useState } from "react";
import { shareGif } from "@/shared/lib/share";

interface Props {
  url: string;
  shareUrl?: string;
  className?: string;
}

export function ShareButton({ url, shareUrl, className }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    try {
      const method = await shareGif(url, shareUrl);
      if (method === "clipboard") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }

  return (
    <button onClick={handleShare} className={className}>
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      {copied ? "링크 복사됨" : "공유하기"}
    </button>
  );
}
