import { API_BASE } from "@/shared/lib/api-base";

export type DailyRewardStatus = {
  claim_date: string;
  claimed: boolean;
  granted: boolean;
  server_now: string;
  next_claim_at: string;
  expires_at: string | null;
};

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function fetchDailyReward(authFetch: AuthFetch, claim = false): Promise<DailyRewardStatus> {
  const response = await authFetch(`${API_BASE}/experiments/exp-001/daily-reward`, {
    method: claim ? "POST" : "GET", cache: "no-store",
  });
  if (!response.ok) throw new Error(claim ? "이용권 지급을 확인하지 못했어요. 다시 눌러 확인해주세요." : "이용권 상태를 불러오지 못했어요.");
  const data: unknown = await response.json();
  if (typeof data !== "object" || data === null ||
    !("claim_date" in data) || typeof data.claim_date !== "string" ||
    !("claimed" in data) || typeof data.claimed !== "boolean" ||
    !("granted" in data) || typeof data.granted !== "boolean" ||
    !("server_now" in data) || typeof data.server_now !== "string" || !Number.isFinite(Date.parse(data.server_now)) ||
    !("next_claim_at" in data) || typeof data.next_claim_at !== "string" || !Number.isFinite(Date.parse(data.next_claim_at)) ||
    Date.parse(data.next_claim_at) <= Date.parse(data.server_now) ||
    !("expires_at" in data) || !(data.expires_at === null || (typeof data.expires_at === "string" && Number.isFinite(Date.parse(data.expires_at))))) {
    throw new Error("이용권 응답을 확인하지 못했어요.");
  }
  return data as DailyRewardStatus;
}

export function requestDailyRewardMenuOpen(source: "survey_success" | "insufficient_pass"): void {
  document.dispatchEvent(new CustomEvent("open-daily-reward-menu", { detail: { source } }));
}
