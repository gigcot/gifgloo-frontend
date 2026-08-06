"use client";

import { useState } from "react";
import type { CompositionJob } from "@/features/compositions/model/types";
import { API_BASE } from "@/shared/lib/api-base";
import { downloadGif } from "@/shared/lib/download";
import { ShareButton } from "@/shared/ui/ShareButton";

type Props = {
  job: CompositionJob;
  onClose: () => void;
};

function MediaTile({
  src,
  alt,
  label,
  className = "",
  imageClassName = "object-cover",
  pendingText = "처리 중",
}: {
  src?: string | null;
  alt: string;
  label?: string;
  className?: string;
  imageClassName?: string;
  pendingText?: string;
}) {
  const [failed, setFailed] = useState(false);
  const canShowImage = src && !failed;

  return (
    <div className={`flex shrink-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-black ${className}`}>
      {label && (
        <div className="border-b border-white/10 bg-white/[0.03] px-3 py-2">
          <p className="truncate text-xs font-semibold text-white/45">{label}</p>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {canShowImage ? (
          <img
            src={src}
            alt={alt}
            onError={() => setFailed(true)}
            className={`h-full w-full ${imageClassName}`}
          />
        ) : (
          <div className="flex h-full min-h-28 w-full items-center justify-center px-3 text-center text-xs font-medium text-white/35">
            {src ? "미리보기를 불러오지 못했어요" : pendingText}
          </div>
        )}
      </div>
    </div>
  );
}

export function CompositionDetailModal({ job, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-3xl border border-white/10 bg-[#111113] p-5 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-white/20 sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-white">합성 결과</p>
            <p className="mt-1 text-sm text-white/40">
              {job.status === "COMPLETED" ? "완성된 GIF를 확인해보세요" : "작업이 진행 중이에요"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 transition-colors hover:border-white/25 hover:text-white"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <MediaTile
          src={job.result_url}
          alt="합성 결과"
          className="h-[45vh] min-h-72 max-h-[560px] w-full"
          imageClassName="object-contain"
        />

        {job.result_url && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => downloadGif(`${API_BASE}/assets/${job.result_asset_id}/download`)}
              disabled={!job.result_asset_id}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-purple-600 py-3 text-sm font-bold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              다운로드
            </button>
            <ShareButton
              assetId={job.result_asset_id ?? undefined}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.03] py-3 text-sm font-semibold text-white/70 transition-colors hover:border-white/35 hover:text-white"
            />
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold text-white/40">사용한 재료</p>
          <div className="grid grid-cols-2 gap-2">
            <MediaTile src={job.source_gif_url} alt="베이스 GIF" label="베이스 GIF" className="aspect-square" />
            <MediaTile src={job.target_url} alt="내 사진" label="내 사진" className="aspect-square" />
          </div>
        </div>
      </div>
    </div>
  );
}
