"use client";

import type { Gif } from "@/entities/gif/model";
import { getGifUrl } from "@/entities/gif/model";
import { useGifSearch } from "@/features/gif-search/model/use-gif-search";
import { trackEvent } from "@/shared/lib/umami";

type Props = {
  query: string;
  trendingGifs: Gif[];
  trendingHasMore?: boolean;
  trendingLoadingMore?: boolean;
  selectedId: string | null;
  onSelect: (gif: Gif) => void;
  onLoadMoreTrending?: () => void;
};

export function GifGrid({
  query,
  trendingGifs,
  trendingHasMore = false,
  trendingLoadingMore = false,
  selectedId,
  onSelect,
  onLoadMoreTrending,
}: Props) {
  const {
    results: searchResults,
    loading,
    loadingMore: searchLoadingMore,
    error: searchError,
    hasMore: searchHasMore,
    loadMore: loadMoreSearch,
  } = useGifSearch(query);

  const gifs = query ? searchResults : trendingGifs;
  const hasMore = query ? searchHasMore : trendingHasMore;
  const loadingMore = query ? searchLoadingMore : trendingLoadingMore;

  function selectGif(gif: Gif) {
    trackEvent("gif_selected", { source: query ? "search" : "trending" });
    onSelect(gif);
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const target = e.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom > 600 || loadingMore || !hasMore) return;

    if (query) {
      loadMoreSearch();
    } else {
      onLoadMoreTrending?.();
    }
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const footer = document.querySelector("footer");
    const footerVisible = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;

    if (e.deltaY < 0 && footerVisible && window.scrollY > 0) {
      e.preventDefault();
      window.scrollBy({ top: e.deltaY, behavior: "auto" });
    }
  }

  if (loading || (!query && trendingGifs.length === 0)) {
    return (
      <div className="h-[72vh] overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2">
        <div className="columns-2 gap-2 sm:columns-3 md:columns-4 lg:columns-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="mb-2 animate-pulse rounded-lg bg-white/10"
            style={{ height: `${180 + (i % 3) * 40}px` }}
          />
        ))}
        </div>
      </div>
    );
  }

  if (searchError) {
    return (
      <p className="py-12 text-center text-white/40">검색 중 오류가 발생했어요. 다시 시도해 주세요.</p>
    );
  }

  if (gifs.length === 0) {
    return (
      <p className="py-12 text-center text-white/40">검색 결과가 없어요</p>
    );
  }

  return (
    <div
      onScroll={handleScroll}
      onWheel={handleWheel}
      className="h-[72vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-2 pr-1 [scrollbar-color:rgba(255,255,255,0.24)_transparent] [scrollbar-width:thin]"
    >
      <div className="columns-2 gap-2 sm:columns-3 md:columns-4 lg:columns-5">
        {gifs.map((gif) => (
          <div
            key={gif.id}
            onClick={() => selectGif(gif)}
            className={`mb-2 cursor-pointer overflow-hidden rounded-lg transition-all ${
              selectedId === gif.id
                ? "ring-2 ring-purple-500 ring-offset-1 ring-offset-[#0d0d0d]"
                : "hover:opacity-80"
            }`}
          >
            <img
              src={getGifUrl(gif, "md")}
              alt={gif.title}
              className="w-full object-cover"
              style={gif.blur_preview ? { background: `url(${gif.blur_preview}) center/cover` } : {}}
            />
          </div>
        ))}
      </div>
      {loadingMore && (
        <p className="py-4 text-center text-sm text-white/35">GIF 더 불러오는 중</p>
      )}
      {!hasMore && gifs.length > 0 && (
        <p className="py-4 text-center text-xs text-white/25">마지막 GIF까지 봤어요</p>
      )}
    </div>
  );
}
