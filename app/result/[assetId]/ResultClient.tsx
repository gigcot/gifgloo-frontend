"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { downloadGif } from "@/shared/lib/download";
import { ShareButton } from "@/shared/ui/ShareButton";
import { trackEvent, trackEventOnce } from "@/shared/lib/umami";

type Props = {
  resultUrl: string;
  shareUrl: string;
  downloadUrl: string;
};

export function ResultClient({ resultUrl, shareUrl, downloadUrl }: Props) {
  const router = useRouter();

  useEffect(() => {
    trackEventOnce(
      `shared_result_viewed:${shareUrl}`,
      "shared_result_viewed",
    );
  }, [shareUrl]);

  function startComposition() {
    trackEvent("shared_result_compose_clicked");
    router.push("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#0d0d0d] px-4 py-10 text-white">
      <p className="mb-6 text-2xl font-black">gifgloo에서 만든 GIF</p>

      <div className="w-full max-w-sm overflow-hidden rounded-2xl">
        <img src={resultUrl} alt="합성 결과" className="w-full object-cover" />
      </div>

      <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
        <button
          onClick={() => downloadGif(downloadUrl, "shared_result")}
          className="w-full rounded-full bg-purple-600 py-4 text-base font-bold text-white transition-colors hover:bg-purple-700"
        >
          다운로드
        </button>
        <div className="flex gap-2">
          <ShareButton
            shareUrl={shareUrl}
            analyticsSource="shared_result"
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
          />
          <button
            onClick={startComposition}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            나도 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
