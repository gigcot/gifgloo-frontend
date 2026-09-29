"use client";

import { useEffect, useSyncExternalStore } from "react";
import { API_BASE } from "@/shared/lib/api-base";
import { useAuth } from "@/shared/lib/use-auth";

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type SurveyStatus =
  | { status: "idle"; userId: string | null }
  | { status: "loading"; userId: string }
  | {
      status: "done";
      userId: string;
      eligible: boolean;
      submitted: boolean;
    }
  | { status: "error"; userId: string };

export type IntendedContext =
  | "direct_chat"
  | "group_chat"
  | "community_post"
  | "sns"
  | "personal_keep"
  | "curiosity"
  | "other";

export type ActualAction =
  | "viewed_only"
  | "saved"
  | "direct_chat"
  | "group_chat"
  | "community_post"
  | "sns"
  | "shared_link"
  | "other";

export type NonExternalUseReason =
  | "unexpected_result"
  | "no_situation"
  | "save_share_inconvenient"
  | "showing_burden"
  | "rights_concern"
  | "curiosity_only"
  | "personal_keep"
  | "planned_not_yet"
  | "other";

export type Exp001SurveyAnswers = {
  intended_context: IntendedContext;
  actual_actions: ActualAction[];
  intended_context_other?: string;
  actual_action_other?: string;
  non_external_use_reasons?: NonExternalUseReason[];
  non_external_use_reason_other?: string;
  next_context?: string;
};

const INITIAL_STATE: SurveyStatus = { status: "idle", userId: null };

let state: SurveyStatus = INITIAL_STATE;
let request: Promise<void> | null = null;
let requestUserId: string | null = null;
const listeners = new Set<() => void>();

function emit(next: SurveyStatus) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function parseStatus(data: unknown): { eligible: boolean; submitted: boolean } {
  if (
    typeof data !== "object" ||
    data === null ||
    !("eligible" in data) ||
    typeof data.eligible !== "boolean" ||
    !("submitted" in data) ||
    typeof data.submitted !== "boolean"
  ) {
    throw new Error("설문 상태 응답이 올바르지 않습니다");
  }
  return { eligible: data.eligible, submitted: data.submitted };
}

async function loadStatus(
  userId: string,
  authFetch: AuthFetch,
  force: boolean,
): Promise<void> {
  if (!force && state.status === "done" && state.userId === userId) return;
  if (request && requestUserId === userId) return request;

  if (force || state.userId !== userId || state.status === "idle") {
    emit({ status: "loading", userId });
  }
  requestUserId = userId;
  request = authFetch(`${API_BASE}/experiments/exp-001/survey`)
    .then(async (response) => {
      if (!response.ok) throw new Error("설문 상태를 불러오지 못했습니다");
      const result = parseStatus(await response.json());
      if (requestUserId === userId) {
        emit({ status: "done", userId, ...result });
      }
    })
    .catch(() => {
      if (requestUserId === userId) emit({ status: "error", userId });
    })
    .finally(() => {
      if (requestUserId === userId) {
        request = null;
        requestUserId = null;
      }
    });
  return request;
}

export function useExp001SurveyStatus(): SurveyStatus {
  const { authFetch, checked, isLoggedIn, userId } = useAuth();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => INITIAL_STATE);

  useEffect(() => {
    if (!checked) return;
    if (!isLoggedIn || !userId) {
      if (state !== INITIAL_STATE) emit(INITIAL_STATE);
      return;
    }
    void loadStatus(userId, authFetch, false);
  }, [authFetch, checked, isLoggedIn, userId]);

  if (!userId || snapshot.userId !== userId) return INITIAL_STATE;
  return snapshot;
}

export async function refreshExp001SurveyStatus(
  authFetch: AuthFetch,
  userId: string,
): Promise<void> {
  await loadStatus(userId, authFetch, true);
}

export async function submitExp001Survey(
  authFetch: AuthFetch,
  userId: string,
  answers: Exp001SurveyAnswers,
): Promise<void> {
  const response = await authFetch(`${API_BASE}/experiments/exp-001/survey`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answers),
  });
  if (!response.ok) throw new Error("설문 응답을 저장하지 못했습니다");

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("submitted" in data) ||
    data.submitted !== true
  ) {
    throw new Error("설문 제출 응답이 올바르지 않습니다");
  }

  const eligible =
    state.status === "done" && state.userId === userId
      ? state.eligible
      : true;
  emit({ status: "done", userId, eligible, submitted: true });
}
