"use client";

import { useState } from "react";
import { useMyCompositions } from "@/features/compositions/model/use-my-compositions";
import { CompositionDetailModal } from "@/features/compositions/ui/CompositionDetailModal";
import type { CompositionJob } from "@/features/compositions/model/types";

function StatusBadge({ status }: { status: CompositionJob["status"] }) {
  if (status === "COMPLETED") return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-400" />
        <span className="text-xs font-semibold text-white/80">처리 중</span>
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
  const [selected, setSelected] = useState<CompositionJob | null>(null);

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

  return (
    <>
      <Banner />
      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-1 pt-1">
        {state.jobs.map((job) => (
          <div
            key={job.job_id}
            onClick={() => setSelected(job)}
            className="relative aspect-square cursor-pointer overflow-hidden transition-opacity hover:opacity-80"
          >
            <img
              src={job.result_url ?? job.source_gif_url}
              alt="합성 결과"
              className="h-full w-full object-cover"
            />
            <StatusBadge status={job.status} />
          </div>
        ))}
      </div>

      {selected && (
        <CompositionDetailModal job={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
