import { API_BASE } from "@/shared/lib/api-base";

export type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function getCompositionFeedback(
  authFetch: AuthFetch,
  compositionJobId: string,
  signal: AbortSignal,
): Promise<boolean | null> {
  const response = await authFetch(`${API_BASE}/compositions/${encodeURIComponent(compositionJobId)}/feedback`, {
    cache: "no-store", signal,
  });
  if (!response.ok) throw new Error("평가 상태를 불러오지 못했어요.");
  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null || !("satisfied" in data)
    || (data.satisfied !== null && typeof data.satisfied !== "boolean")) {
    throw new Error("평가 상태 응답이 올바르지 않아요.");
  }
  return data.satisfied;
}

export async function submitCompositionFeedback(
  authFetch: AuthFetch,
  compositionJobId: string,
  satisfied: boolean,
  signal: AbortSignal,
): Promise<"created" | "already_submitted"> {
  const response = await authFetch(`${API_BASE}/compositions/${encodeURIComponent(compositionJobId)}/feedback`, {
    method: "PUT",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ satisfied }),
  });

  if (response.status === 409) return "already_submitted";
  if (!response.ok) {
    throw new Error("만족도 응답을 저장하지 못했어요.");
  }
  return "created";
}
