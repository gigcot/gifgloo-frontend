"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Gif } from "@/entities/gif/model";
import { fetchSearchPage } from "@/shared/api/klipy";
import { trackEvent } from "@/shared/lib/umami";

type SearchState = { query: string; results: Gif[]; page: number; loading: boolean; loadingMore: boolean; error: boolean; hasMore: boolean };
const empty: SearchState = { query: "", results: [], page: 1, loading: false, loadingMore: false, error: false, hasMore: false };
export function useGifSearch(query: string) {
  const [state, setState] = useState<SearchState>(empty);
  const requestRef = useRef<AbortController | null>(null);
  const moreRef = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    requestRef.current = controller;
    moreRef.current = false;
    const timer = setTimeout(async () => {
      if (!query) { setState(empty); return; }
      setState({ ...empty, query, loading: true });
      trackEvent("gif_search_requested");
      try {
        const page = await fetchSearchPage(query, 1, 24, controller.signal);
        if (controller.signal.aborted) return;
        setState({ ...empty, query, results: page.items, page: page.currentPage, hasMore: page.hasNext });
        trackEvent("gif_search_result", { status: "success", count: page.items.length });
      } catch {
        if (controller.signal.aborted) return;
        setState({ ...empty, query, error: true });
        trackEvent("gif_search_result", { status: "error", count: 0 });
      }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  const loadMore = useCallback(() => {
    const controller = requestRef.current;
    if (!controller || !query || state.query !== query || state.loading || moreRef.current || !state.hasMore) return;
    moreRef.current = true;
    setState(current => ({ ...current, loadingMore: true }));
    fetchSearchPage(query, state.page + 1, 24, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      setState(current => ({ ...current, results: [...new Map([...current.results, ...page.items].map(gif => [gif.id, gif])).values()],
        page: page.currentPage, hasMore: page.hasNext, error: false }));
    }).catch(() => {
      if (!controller.signal.aborted) setState(current => ({ ...current, error: true }));
    }).finally(() => {
      if (!controller.signal.aborted) { moreRef.current = false; setState(current => ({ ...current, loadingMore: false })); }
    });
  }, [query, state]);
  return { ...(query ? state.query === query ? state : { ...empty, loading: true } : empty), loadMore };
}
