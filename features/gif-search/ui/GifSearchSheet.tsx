"use client";

import { useState, useEffect, useRef } from "react";
import type { Gif } from "@/entities/gif/model";
import { getGifUrl } from "@/entities/gif/model";
import { fetchTrending } from "@/shared/api/klipy";
import { useGifSearch } from "@/features/gif-search/model/use-gif-search";

type Props = {
  onSelect: (gif: Gif) => void;
  onClose: () => void;
};

const TRENDING_CATEGORIES = ["Love", "Happy", "Hello", "Excited", "Funny", "Hug", "Party", "Sad"];

function GifList({
  query,
  trendingGifs,
  onSelect,
}: {
  query: string;
  trendingGifs: Gif[];
  onSelect: (gif: Gif) => void;
}) {
  const { results, loading, error } = useGifSearch(query);
  const gifs = query ? results : trendingGifs;

  if (loading || (!query && trendingGifs.length === 0)) {
    return (
      <div className="columns-2 gap-2 sm:columns-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="mb-2 animate-pulse rounded-lg bg-white/10"
            style={{ height: `${140 + (i % 3) * 30}px` }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="py-12 text-center text-sm text-white/40">검색 중 오류가 발생했어요.</p>;
  }

  if (gifs.length === 0) {
    return <p className="py-12 text-center text-sm text-white/40">검색 결과가 없어요</p>;
  }

  return (
    <div className="columns-2 gap-2 sm:columns-3">
      {gifs.map((gif) => (
        <div
          key={gif.id}
          onClick={() => onSelect(gif)}
          className="mb-2 cursor-pointer overflow-hidden rounded-lg hover:opacity-80"
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
  );
}

export function GifSearchSheet({ onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [trendingGifs, setTrendingGifs] = useState<Gif[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTrending(1, 24).then(setTrendingGifs).catch(() => {});
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-screen-xl flex-col rounded-t-3xl bg-[#1a1a1a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* 검색창 */}
        <div className="px-4 py-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              placeholder="GIF 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full bg-white/10 px-5 py-3 text-base text-white placeholder-white/40 outline-none focus:bg-white/15"
            />
            {query ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <svg
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
                width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>

          {/* 카테고리 칩 */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {TRENDING_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setQuery(cat)}
                className="shrink-0 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-purple-600/50 hover:text-white"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* GIF 그리드 */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <GifList query={query} trendingGifs={trendingGifs} onSelect={onSelect} />
        </div>
      </div>
    </div>
  );
}
