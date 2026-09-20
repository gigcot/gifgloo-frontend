import { API_BASE } from "@/shared/lib/api-base";

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function submitCompositionFeedback(
  authFetch: AuthFetch,
  compositionJobId: string,
  satisfied: boolean,
): Promise<void> {
  const response = await authFetch(`${API_BASE}/compositions/${compositionJobId}/feedback`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ satisfied }),
  });

  if (!response.ok) {
    throw new Error("만족도 응답을 저장하지 못했어요.");
  }
}
