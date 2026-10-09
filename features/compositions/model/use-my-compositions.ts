"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/shared/lib/use-auth";
import { API_BASE } from "@/shared/lib/api-base";
import type { CompositionJob } from "./types";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; jobs: CompositionJob[]; refreshFailed: boolean };

export function useMyCompositions(): State {
  const { authFetch, userId, checked } = useAuth();
  const [snapshot, setSnapshot] = useState<{ ownerId: string; state: State } | null>(null);

  useEffect(() => {
    if (!checked || !userId) return;
    const ownerId = userId;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loading = false;

    async function refresh() {
      if (controller.signal.aborted || loading || document.visibilityState === "hidden") return;
      clearTimeout(timer);
      loading = true;
      let keepRefreshing = false;
      try {
        const response = await authFetch(`${API_BASE}/compositions`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("작업을 불러오지 못했어요.");
        const data: { jobs: CompositionJob[] } = await response.json();
        if (controller.signal.aborted) return;
        keepRefreshing = data.jobs.some(job => job.status === "PENDING" || job.status === "PROCESSING");
        setSnapshot({ ownerId, state: { status: "done", jobs: data.jobs, refreshFailed: false } });
      } catch {
        if (controller.signal.aborted) return;
        keepRefreshing = true;
        setSnapshot(current => ({ ownerId, state: current?.ownerId === ownerId && current.state.status === "done"
          ? { ...current.state, refreshFailed: true } : { status: "error" } }));
      } finally {
        loading = false;
        if (!controller.signal.aborted && keepRefreshing) timer = setTimeout(() => void refresh(), 5000);
      }
    }

    const onReturn = () => { void refresh(); };
    void refresh();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [authFetch, checked, userId]);

  if (checked && !userId) return { status: "done", jobs: [], refreshFailed: false };
  return snapshot?.ownerId === userId ? snapshot.state : { status: "loading" };
}
