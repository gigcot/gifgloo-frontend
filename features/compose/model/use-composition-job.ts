"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/shared/lib/api-base";

type ProcessingStage =
  | "EXTRACTING_FRAMES"
  | "ANALYZING"
  | "GENERATING_DRAFT"
  | "COMPOSITING"
  | "BUILDING_GIF";

type RawJobStatus = {
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: ProcessingStage | null;
  result_url: string | null;
  result_asset_id: string | null;
  failed_reason: string | null;
  credit_settlement?: RawCreditSettlement | null;
};

type RawCreditSettlement = {
  balance_before: number;
  charged: number;
  refunded: number;
  balance_after: number;
};

export type CreditSettlement = {
  balanceBefore: number;
  charged: number;
  refunded: number;
  balanceAfter: number;
};

export type CompositionJobState = {
  progress: number;       // 0~100
  statusMessage: string;
  resultUrl: string | null;
  resultAssetId: string | null;
  isComplete: boolean;
  isFailed: boolean;
  creditRestored: boolean;
  creditSettlement: CreditSettlement | null;
  failedReason: string | null;
};

const STAGE_INFO: Record<ProcessingStage, { message: string; progress: number }> = {
  EXTRACTING_FRAMES: { message: "프레임 추출 중…",   progress: 20 },
  ANALYZING:         { message: "구도 분석 중…",     progress: 40 },
  GENERATING_DRAFT:  { message: "드래프트 생성 중…", progress: 60 },
  COMPOSITING:       { message: "프레임 합성 중…",   progress: 80 },
  BUILDING_GIF:      { message: "GIF 조합 중…",      progress: 95 },
};

const IDLE: CompositionJobState = {
  progress: 0,
  statusMessage: "",
  resultUrl: null,
  resultAssetId: null,
  isComplete: false,
  isFailed: false,
  creditRestored: false,
  creditSettlement: null,
  failedReason: null,
};

const WAITING: CompositionJobState = {
  ...IDLE,
  progress: 5,
  statusMessage: "대기 중…",
};

type JobSnapshot = {
  jobId: string;
  state: CompositionJobState;
};

function parseCreditSettlement(value: RawCreditSettlement | null | undefined): CreditSettlement | null {
  if (!value) return null;
  if (
    !Number.isInteger(value.balance_before) || value.balance_before < 0 ||
    !Number.isInteger(value.charged) || value.charged < 0 ||
    !Number.isInteger(value.refunded) || value.refunded < 0 ||
    !Number.isInteger(value.balance_after) || value.balance_after < 0
  ) {
    return null;
  }

  return {
    balanceBefore: value.balance_before,
    charged: value.charged,
    refunded: value.refunded,
    balanceAfter: value.balance_after,
  };
}

export function useCompositionJob(jobId: string | null): CompositionJobState {
  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const activeJobId = jobId;

    const es = new EventSource(`${API_BASE}/compositions/${activeJobId}/status`, {
      withCredentials: true,
    });

    function updateState(
      update: (current: CompositionJobState) => CompositionJobState,
    ) {
      setSnapshot((current) => ({
        jobId: activeJobId,
        state: update(current?.jobId === activeJobId ? current.state : WAITING),
      }));
    }

    es.onmessage = (ev) => {
      let data: RawJobStatus;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (data.status === "PENDING") {
        setSnapshot({ jobId: activeJobId, state: WAITING });
        return;
      }

      if (data.status === "PROCESSING" && data.stage) {
        const { message, progress } = STAGE_INFO[data.stage];
        updateState((current) => ({ ...current, statusMessage: message, progress }));
        return;
      }

      if (data.status === "COMPLETED" && data.result_url) {
        setSnapshot({
          jobId: activeJobId,
          state: {
            progress: 100,
            statusMessage: "완료!",
            resultUrl: data.result_url,
            resultAssetId: data.result_asset_id,
            isComplete: true,
            isFailed: false,
            creditRestored: false,
            creditSettlement: parseCreditSettlement(data.credit_settlement),
            failedReason: null,
          },
        });
        es.close();
        return;
      }

      if (data.status === "FAILED") {
        const creditSettlement = parseCreditSettlement(data.credit_settlement);
        updateState((current) => ({
          ...current,
          isFailed: true,
          creditRestored: creditSettlement !== null && creditSettlement.refunded > 0,
          creditSettlement,
          failedReason: "작업에 실패했습니다. 다시 시도해주세요.",
        }));
        es.close();
      }
    };

    es.onerror = () => {
      updateState((current) => ({
        ...current,
        isFailed: true,
        creditRestored: false,
        creditSettlement: null,
        failedReason: "서버 연결이 끊어졌어요. 작업 상태는 내 결과물에서 확인해주세요.",
      }));
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  if (!jobId) return IDLE;
  return snapshot?.jobId === jobId ? snapshot.state : WAITING;
}
