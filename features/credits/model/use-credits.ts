"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { API_BASE } from "@/shared/lib/api-base";

type State =
  | { status: "loading" }
  | ({ status: "done" } & PassBalance)
  | { status: "error" };

export type PassBalance = {
  balance: number;
  remainingUses: number;
  nearestExpiresAt: string | null;
};

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let refreshVersion = 0;
const refreshListeners = new Set<() => void>();

function subscribeToRefresh(listener: () => void): () => void {
  refreshListeners.add(listener);
  return () => refreshListeners.delete(listener);
}

export function requestCreditBalanceRefresh(): void {
  refreshVersion += 1;
  for (const listener of refreshListeners) listener();
}

export async function fetchCreditBalance(authFetch: AuthFetch): Promise<PassBalance> {
  const response = await authFetch(`${API_BASE}/credits/balance`);
  if (!response.ok) throw new Error("이용권 정보를 불러오지 못했습니다");

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("balance" in data) ||
    typeof data.balance !== "number" ||
    !("remaining_uses" in data) ||
    typeof data.remaining_uses !== "number" ||
    !("nearest_expires_at" in data) ||
    (data.nearest_expires_at !== null && typeof data.nearest_expires_at !== "string")
  ) {
    throw new Error("이용권 응답이 올바르지 않습니다");
  }

  return {
    balance: data.balance,
    remainingUses: data.remaining_uses,
    nearestExpiresAt: data.nearest_expires_at,
  };
}

export function useCredits(): State {
  const { authFetch, userId } = useAuth();
  const version = useSyncExternalStore(
    subscribeToRefresh,
    () => refreshVersion,
    () => 0,
  );
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (!userId) return;
    let current = true;
    fetchCreditBalance(authFetch)
      .then((balance) => { if (current) setState({ status: "done", ...balance }); })
      .catch(() => { if (current) setState({ status: "error" }); });
    return () => { current = false; };
  }, [authFetch, userId, version]);

  return state;
}
