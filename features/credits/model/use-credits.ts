"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { API_BASE } from "@/shared/lib/api-base";

type State =
  | { status: "loading" }
  | { status: "done"; balance: number }
  | { status: "error" };

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function fetchCreditBalance(authFetch: AuthFetch): Promise<number> {
  const response = await authFetch(`${API_BASE}/credits/balance`);
  if (!response.ok) throw new Error("크레딧 잔액을 불러오지 못했습니다");

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("balance" in data) ||
    typeof data.balance !== "number"
  ) {
    throw new Error("크레딧 잔액 응답이 올바르지 않습니다");
  }

  return data.balance;
}

export function useCredits(): State {
  const { authFetch } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetchCreditBalance(authFetch)
      .then((balance) => setState({ status: "done", balance }))
      .catch(() => setState({ status: "error" }));
  }, [authFetch]);

  return state;
}
