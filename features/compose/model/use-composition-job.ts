"use client";

import { useEffect, useRef, useState } from "react";
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
};

export type CompositionJobState = {
  progress: number;       // 0~100
  statusMessage: string;
  resultUrl: string | null;
  resultAssetId: string | null;
  isComplete: boolean;
  isFailed: boolean;
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
  failedReason: null,
};

export function useCompositionJob(jobId: string | null): CompositionJobState {
  const [state, setState] = useState<CompositionJobState>(IDLE);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) {
      setState(IDLE);
      return;
    }

    esRef.current?.close();
    setState({ ...IDLE, statusMessage: "대기 중…", progress: 5 });

    const es = new EventSource(`${API_BASE}/compositions/${jobId}/status`, {
      withCredentials: true,
    });
    esRef.current = es;

    es.onmessage = (ev) => {
      let data: RawJobStatus;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (data.status === "PENDING") {
        setState((s) => ({ ...s, statusMessage: "대기 중…", progress: 5 }));
        return;
      }

      if (data.status === "PROCESSING" && data.stage) {
        const { message, progress } = STAGE_INFO[data.stage];
        setState((s) => ({ ...s, statusMessage: message, progress }));
        return;
      }

      if (data.status === "COMPLETED" && data.result_url) {
        setState({
          progress: 100,
          statusMessage: "완료!",
          resultUrl: data.result_url,
          resultAssetId: data.result_asset_id,
          isComplete: true,
          isFailed: false,
          failedReason: null,
        });
        es.close();
        return;
      }

      if (data.status === "FAILED") {
        setState((s) => ({
          ...s,
          isFailed: true,
          failedReason: "합성 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
        }));
        es.close();
      }
    };

    es.onerror = () => {
      setState((s) => ({
        ...s,
        isFailed: true,
        failedReason: "서버 연결이 끊어졌어요",
      }));
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  return state;
}
