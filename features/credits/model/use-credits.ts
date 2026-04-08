"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { API_BASE } from "@/shared/lib/api-base";

type State =
  | { status: "loading" }
  | { status: "done"; balance: number }
  | { status: "error" };

export function useCredits(): State {
  const { authFetch } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    authFetch(`${API_BASE}/credits/balance`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setState({ status: "done", balance: data.balance }))
      .catch(() => setState({ status: "error" }));
  }, [authFetch]);

  return state;
}
