"use client";

import type { CompositionJob } from "@/features/compositions/model/types";
import { ShareButton } from "@/shared/ui/ShareButton";

type Props = {
  job: CompositionJob;
  onClose: () => void;
};

export function CompositionDetailModal({ job, onClose }: Props) {
  function handleDownload() {
    if (!job.result_url) return;
    const a = document.createElement("a");
    a.href = job.result_url;
    a.download = "gifgloo.gif";
    a.click();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-t-3xl bg-[#1a1a1a] p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20 sm:hidden" />

        {/* 이미지 3종 */}
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-center text-xs font-semibold text-white/40">베이스 GIF</p>
            <div className="aspect-square overflow-hidden rounded-xl">
              <img src={job.source_gif_url} alt="베이스 GIF" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="flex items-center text-white/30">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-center text-xs font-semibold text-white/40">내 사진</p>
            <div className="aspect-square overflow-hidden rounded-xl">
              <img src={job.target_url} alt="내 사진" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="flex items-center text-white/30">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-center text-xs font-semibold text-white/40">결과</p>
            <div className="aspect-square overflow-hidden rounded-xl">
              {job.result_url
                ? <img src={job.result_url} alt="합성 결과" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center bg-white/5 text-xs text-white/30">처리 중</div>
              }
            </div>
          </div>
        </div>

        {/* 액션 버튼 (완료된 경우만) */}
        {job.result_url && (
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-700"
            >
              저장하기
            </button>
            <ShareButton
              url={job.result_url}
              shareUrl={`${window.location.origin}/result/${job.job_id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-white/70 transition-colors hover:border-white/40 hover:text-white"
            />
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full rounded-full border border-white/10 py-3 text-sm font-medium text-white/40 transition-colors hover:text-white/70"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
