"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMyCompositions } from "@/features/compositions/model/use-my-compositions";
import { CompositionDetailModal } from "@/features/compositions/ui/CompositionDetailModal";
import type { CompositionJob } from "@/features/compositions/model/types";
import { Exp001SurveyInvitation } from "@/features/experiment/ui/Exp001SurveyInvitation";
import { trackEvent } from "@/shared/lib/analytics";

function StatusBadge({ status }: { status: CompositionJob["status"] }) {
  if (status === "COMPLETED") return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
        <span className="text-xs font-semibold text-white/80">{status === "FAILED" ? "실패 · 상세 확인" : "처리 중 · 이어 보기"}</span>
      </div>
    </div>
  );
}

function Banner({ showInvitation = true }: { showInvitation?: boolean }) {
  return (
    <>
      <div className="bg-purple-600 px-4 py-5">
        <div className="mx-auto max-w-2xl">
          <p className="text-2xl font-black text-white">내가 만든 GIF</p>
        </div>
      </div>
      {showInvitation && <div className="mx-auto max-w-2xl px-4 py-4"><Exp001SurveyInvitation source="my_assets_page" /></div>}
    </>
  );
}

function CompositionGrid({ jobs, onSelect }: { jobs: CompositionJob[]; onSelect: (jobId: string) => void }) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current!;
    const style = getComputedStyle(grid);
    const gap = parseFloat(style.columnGap);
    const rowHeight = parseFloat(style.gridAutoRows);
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const tile = entry.target as HTMLButtonElement;
        const span = Math.ceil((entry.borderBoxSize[0].blockSize + gap) / rowHeight);
        tile.style.gridRowEnd = `span ${span}`;
      }
    });
    for (const tile of grid.children) observer.observe(tile);
    return () => observer.disconnect();
  }, [jobs]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-1">
      <div ref={gridRef} className="grid auto-rows-[4px] grid-cols-2 items-start gap-x-2.5 sm:grid-cols-3">
        {jobs.map(job => (
          <button type="button"
            key={job.job_id}
            aria-label={job.status === "COMPLETED" ? "완성된 GIF 보기" : job.status === "FAILED" ? "실패한 작업 확인" : "진행 중인 작업 이어 보기"}
            onClick={() => {
              if (job.status === "COMPLETED") onSelect(job.job_id);
              else {
                trackEvent("composition_resume_clicked", { job_id: job.job_id, status: job.status });
                router.push(`/compose?job=${encodeURIComponent(job.job_id)}`);
              }
            }}
            className="relative min-h-12 w-full cursor-pointer overflow-hidden rounded-lg bg-white/5 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400"
          >
            <img
              src={job.result_url ?? job.source_gif_url}
              alt="합성 결과"
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
            <StatusBadge status={job.status} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function MyAssetsPage() {
  const state = useMyCompositions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (state.status === "loading") {
    return (
      <>
        <Banner />
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2.5 px-4 pb-8 pt-1 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-white/10" />
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
      <Banner showInvitation={!selectedJob} />
      {state.refreshFailed && <p role="status" className="p-4 text-center text-sm text-white/70">최신 상태를 다시 확인하고 있어요. 아래는 마지막으로 확인한 목록이에요.</p>}
      <CompositionGrid jobs={state.jobs} onSelect={setSelectedId} />

      {selectedJob && (
        <CompositionDetailModal job={selectedJob} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
