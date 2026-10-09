"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMyCompositions } from "@/features/compositions/model/use-my-compositions";
import { CompositionDetailModal } from "@/features/compositions/ui/CompositionDetailModal";
import type { CompositionJob } from "@/features/compositions/model/types";
import { trackEvent } from "@/shared/lib/umami";

function StatusBadge({ status }: { status: CompositionJob["status"] }) {
  if (status === "COMPLETED") return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
        <span className="text-xs font-semibold text-white/80">{status === "FAILED" ? "실패 · 상세 확인" : "처리 중 · 이어 보기"}</span>
      </div>
    </div>
  );
}

function Banner() {
  return (
    <div className="bg-purple-600 px-4 py-5">
      <div className="mx-auto max-w-2xl">
        <p className="text-2xl font-black text-white">내가 만든 GIF</p>
      </div>
    </div>
  );
}

export function MyAssetsPage() {
  const state = useMyCompositions();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (state.status === "loading") {
    return (
      <>
        <Banner />
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-1 pt-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse bg-white/10" />
          ))}
        </div>
      </>
    );
  }

  if (state.status === "error") {
    return (
      <>
        <Banner />
        <p className="py-20 text-center text-sm text-white/40">불러오는 중 오류가 발생했어요. 새로고침해 주세요.</p>
      </>
    );
  }

  if (state.jobs.length === 0) {
    return (
      <>
        <Banner />
        <p className="py-20 text-center text-sm text-white/40">아직 만든 GIF가 없어요.</p>
      </>
    );
  }

  const selectedJob = state.jobs.find(job => job.job_id === selectedId);

  return (
    <>
      <Banner />
      {state.refreshFailed && <p role="status" className="p-4 text-center text-sm text-white/70">최신 상태를 다시 확인하고 있어요. 아래는 마지막으로 확인한 목록이에요.</p>}
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-1 pt-1">
        {state.jobs.map((job) => (
          <button type="button"
            key={job.job_id}
            aria-label={job.status === "COMPLETED" ? "완성된 GIF 보기" : job.status === "FAILED" ? "실패한 작업 확인" : "진행 중인 작업 이어 보기"}
            onClick={() => {
              if (job.status === "COMPLETED") setSelectedId(job.job_id);
              else {
                trackEvent("composition_resume_clicked", { job_id: job.job_id, status: job.status });
                router.push(`/compose?job=${encodeURIComponent(job.job_id)}`);
              }
            }}
            className="relative aspect-square cursor-pointer overflow-hidden transition-opacity hover:opacity-80"
          >
            <img
              src={job.result_url ?? job.source_gif_url}
              alt="합성 결과"
              className="h-full w-full object-cover"
            />
            <StatusBadge status={job.status} />
          </button>
        ))}
      </div>

      {selectedJob && (
        <CompositionDetailModal job={selectedJob} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
