"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { API_BASE } from "@/shared/lib/api-base";
import type { CompositionJob } from "./types";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; jobs: CompositionJob[] };

export function useMyCompositions(): State {
  const { authFetch } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    authFetch(`${API_BASE}/compositions`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        const jobs: CompositionJob[] = (data.jobs ?? []).filter(
          (j: CompositionJob) => j.status !== "FAILED",
        );
        setState({ status: "done", jobs });
      })
      .catch(() => setState({ status: "error" }));
  }, [authFetch]);

  return state;
}
