"use client";

import { useRouter } from "next/navigation";
import { ShareButton } from "@/shared/ui/ShareButton";

type Props = {
  resultUrl: string;
  assetId: string;
};

export function ResultClient({ resultUrl, assetId }: Props) {
  const router = useRouter();
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/result/${assetId}`
    : `/result/${assetId}`;

  async function handleDownload() {
    try {
      const res = await fetch(resultUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], "gifgloo.gif", { type: blob.type });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "gifgloo.gif";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e) {
      console.error("다운로드 실패:", e);
      window.open(resultUrl, "_blank");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#0d0d0d] px-4 py-10 text-white">
      <p className="mb-6 text-2xl font-black">gifgloo에서 만든 GIF</p>

      <div className="w-full max-w-sm overflow-hidden rounded-2xl">
        <img src={resultUrl} alt="합성 결과" className="w-full object-cover" />
      </div>

      <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
        <button
          onClick={handleDownload}
          className="w-full rounded-full bg-purple-600 py-4 text-base font-bold text-white transition-colors hover:bg-purple-700"
        >
          저장하기
        </button>
        <div className="flex gap-2">
          <ShareButton
            url={resultUrl}
            shareUrl={shareUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
          />
          <button
            onClick={() => router.push("/")}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            나도 만들기
          </button>
        </div>
      </div>
    </div>
  );
}
