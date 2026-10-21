"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { isGif, type Gif } from "@/entities/gif/model";
import { fetchSearchPage, fetchTrendingPage } from "@/shared/api/klipy";
import { trackEvent } from "@/shared/lib/analytics";

export type BrowseSurface = "home" | "compose";
type BrowseState = {
  hydrated: boolean;
  view: "results" | "topics";
  categoryId: string | null;
  topicQuery: string | null;
  input: string;
  query: string;
  label: string;
  topicFilter: string;
  items: Gif[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  scrollTop: number;
};

const initialState: BrowseState = {
  hydrated: false, view: "results", categoryId: null, topicQuery: null,
  input: "", query: "", label: "지금 둘러볼 장면", topicFilter: "",
  items: [], page: 0, hasMore: true, loading: true, loadingMore: false, error: false, scrollTop: 0,
};
type BrowseStore = { state: BrowseState; listeners: Set<() => void>; controller: AbortController | null };
const stores: Record<BrowseSurface, BrowseStore> = {
  home: { state: initialState, listeners: new Set(), controller: null },
  compose: { state: initialState, listeners: new Set(), controller: null },
};
const storageKey = (surface: BrowseSurface) => `gifgloo-browse-v1:${surface}`;

function persist(surface: BrowseSurface) {
  const state = stores[surface].state;
  if (!state.hydrated) return;
  try {
    sessionStorage.setItem(storageKey(surface), JSON.stringify({ ...state, loading: false, loadingMore: false }));
  } catch (error) {
    console.warn("GIF browse session could not be saved", error);
  }
}

function update(surface: BrowseSurface, patch: Partial<BrowseState>) {
  const store = stores[surface];
  store.state = { ...store.state, ...patch };
  for (const listener of store.listeners) listener();
}

function restore(surface: BrowseSurface): BrowseState | null {
  try {
    const raw = sessionStorage.getItem(storageKey(surface));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const state = value as Record<string, unknown>;
    if ((state.view !== "results" && state.view !== "topics") ||
      typeof state.query !== "string" || typeof state.input !== "string" || typeof state.label !== "string" ||
      typeof state.topicFilter !== "string" || !Array.isArray(state.items) || !state.items.every(isGif) ||
      !Number.isInteger(state.page) || (state.page as number) < 0 || typeof state.hasMore !== "boolean" ||
      typeof state.scrollTop !== "number" || !Number.isFinite(state.scrollTop) ||
      (state.categoryId !== null && typeof state.categoryId !== "string") ||
      (state.topicQuery !== null && typeof state.topicQuery !== "string")) return null;
    return { ...initialState, ...state, hydrated: true, loading: false, loadingMore: false, error: false } as BrowseState;
  } catch (error) {
    console.warn("GIF browse session could not be restored", error);
    return null;
  }
}

export function rememberGifBrowsePosition(surface: BrowseSurface, scrollTop: number, save = true) {
  stores[surface].state = { ...stores[surface].state, scrollTop: Math.max(0, scrollTop) };
  if (save) persist(surface);
}

export function saveGifBrowseSession(surface: BrowseSurface) { persist(surface); }

async function requestPage(surface: BrowseSurface, append: boolean) {
  const store = stores[surface];
  if (append && (store.state.loading || store.state.loadingMore || !store.state.hasMore)) return;
  store.controller?.abort();
  const controller = new AbortController();
  store.controller = controller;
  const query = store.state.query;
  const nextPage = append ? store.state.page + 1 : 1;
  update(surface, { loading: !append, loadingMore: append, error: false });
  if (!append && query) trackEvent("gif_search_requested", { surface });
  try {
    const page = query
      ? await fetchSearchPage(query, nextPage, 24, controller.signal)
      : await fetchTrendingPage(nextPage, 24, controller.signal);
    if (controller.signal.aborted || store.controller !== controller) return;
    const items = [...new Map([...(append ? store.state.items : []), ...page.items].map(gif => [gif.id, gif])).values()];
    update(surface, { items, page: page.currentPage, hasMore: page.hasNext, loading: false, loadingMore: false, error: false });
    persist(surface);
    if (!append && query) trackEvent("gif_search_result", { status: "success", count: items.length, surface });
  } catch {
    if (controller.signal.aborted || store.controller !== controller) return;
    update(surface, { loading: false, loadingMore: false, error: true });
    if (!append && query) trackEvent("gif_search_result", { status: "error", count: 0, surface });
  }
}

export function useGifBrowser(surface: BrowseSurface) {
  const subscribe = useCallback((listener: () => void) => {
    stores[surface].listeners.add(listener);
    return () => { stores[surface].listeners.delete(listener); };
  }, [surface]);
  const getSnapshot = useCallback(() => stores[surface].state, [surface]);
  const state = useSyncExternalStore(subscribe, getSnapshot, () => initialState);

  useEffect(() => {
    const store = stores[surface];
    if (store.state.hydrated) return;
    update(surface, restore(surface) ?? { ...initialState, hydrated: true });
    if (store.state.view === "results" && store.state.page === 0) void requestPage(surface, false);
    else persist(surface);
  }, [surface]);

  function search(query: string, label: string, categoryId: string | null = null, topicQuery: string | null = null) {
    stores[surface].controller?.abort();
    update(surface, { view: "results", query, input: query ? label : "", label, categoryId, topicQuery,
      topicFilter: "", items: [], page: 0, hasMore: true, scrollTop: 0, error: false });
    persist(surface);
    void requestPage(surface, false);
  }

  function showCategory(categoryId: string, label: string) {
    stores[surface].controller?.abort();
    update(surface, { view: "topics", categoryId, topicQuery: null, query: "", input: "", label,
      topicFilter: "", items: [], page: 0, hasMore: true, scrollTop: 0, loading: false, loadingMore: false, error: false });
    persist(surface);
    trackEvent("gif_category_selected", { category: categoryId, surface });
  }

  return {
    state,
    search,
    showCategory,
    setInput: (input: string) => update(surface, { input }),
    setTopicFilter: (topicFilter: string) => { update(surface, { topicFilter }); persist(surface); },
    loadMore: () => { trackEvent("gif_load_more_clicked", { surface, count: state.items.length }); void requestPage(surface, true); },
    retry: () => void requestPage(surface, state.items.length > 0),
  };
}
