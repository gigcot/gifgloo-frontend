"use client";

import { useEffect, useRef, useState } from "react";
import type { Gif } from "@/entities/gif/model";
import { fetchTrendingPage, type GifCategory } from "@/shared/api/klipy";
import { CategoryPicker } from "./CategoryPicker";
import { FrameHelp } from "./GifFrameInfo";
import { GifGrid } from "./GifGrid";
import { SearchBar } from "./SearchBar";

type Props = {
  selectedId: string | null;
  onSelect: (gif: Gif, source: string) => void;
  surface: "home" | "compose";
  onSourceChange?: (source: string) => void;
};

export function GifExplorer({ selectedId, onSelect, surface, onSourceChange }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GifCategory | null>(null);
  const [trending, setTrending] = useState({ items: [] as Gif[], page: 0, hasMore: true, loading: true, error: false });
  const controllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const source = category ? "category" : query ? "search" : "trending";

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    loadingRef.current = true;
    fetchTrendingPage(1, 24, controller.signal).then(page => {
      if (!controller.signal.aborted) setTrending({ items: page.items, page: page.currentPage, hasMore: page.hasNext, loading: false, error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setTrending(current => ({ ...current, loading: false, error: true }));
    }).finally(() => { if (!controller.signal.aborted) loadingRef.current = false; });
    return () => controller.abort();
  }, []);

  function loadMoreTrending() {
    const controller = controllerRef.current;
    if (!controller || loadingRef.current || !trending.hasMore) return;
    loadingRef.current = true;
    setTrending(current => ({ ...current, loading: true, error: false }));
    fetchTrendingPage(trending.page + 1, 24, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      setTrending(current => ({ items: [...new Map([...current.items, ...page.items].map(gif => [gif.id, gif])).values()],
        page: page.currentPage, hasMore: page.hasNext, loading: false, error: false }));
    }).catch(() => {
      if (!controller.signal.aborted) setTrending(current => ({ ...current, loading: false, error: true }));
    }).finally(() => { if (!controller.signal.aborted) loadingRef.current = false; });
  }

  return <>
    <SearchBar value={query} onChange={value => { setQuery(value); setCategory(null); onSourceChange?.(value ? "search" : "trending"); }} />
    <div className="category-toolbar" role="group" aria-label="GIF 탐색">
      <button className="popular-category" aria-pressed={!query && !category} onClick={() => { setQuery(""); setCategory(null); onSourceChange?.("trending"); }}>인기</button>
      <CategoryPicker selected={category} onSelect={item => { setCategory(item); setQuery(""); onSourceChange?.("category"); }} />
    </div>
    <div className="gif-list-heading"><h3>{query ? "검색 결과" : `${category?.label ?? "인기"} GIF`}</h3><FrameHelp /></div>
    <p className="frame-inspection-hint"><span className="desktop-gesture">마우스를 올리면 프레임 수를 볼 수 있어요.</span><span className="touch-gesture">길게 누르면 프레임 수를 볼 수 있어요.</span></p>
    <GifGrid key={category?.query ?? query} query={category?.query ?? query} source={source} surface={surface}
      trendingGifs={trending.items} trendingHasMore={trending.hasMore} trendingLoadingMore={trending.loading}
      trendingError={trending.error} selectedId={selectedId} onSelect={gif => onSelect(gif, source)} onLoadMoreTrending={loadMoreTrending} />
  </>;
}
