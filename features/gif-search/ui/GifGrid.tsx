"use client";

import type { Gif } from "@/entities/gif/model";
import { getGifUrl } from "@/entities/gif/model";
import { useGifSearch } from "@/features/gif-search/model/use-gif-search";

type Props = {
  query: string;
  trendingGifs: Gif[];
  selectedId: string | null;
  onSelect: (gif: Gif) => void;
};

export function GifGrid({ query, trendingGifs, selectedId, onSelect }: Props) {
  const { results: searchResults, loading, error: searchError } = useGifSearch(query);

  const gifs = query ? searchResults : trendingGifs;

  if (loading || (!query && trendingGifs.length === 0)) {
    return (
      <div className="columns-2 gap-2 sm:columns-3 md:columns-4 lg:columns-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="mb-2 animate-pulse rounded-lg bg-white/10"
            style={{ height: `${180 + (i % 3) * 40}px` }}
          />
        ))}
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
    <div className="columns-2 gap-2 sm:columns-3 md:columns-4 lg:columns-5">
      {gifs.map((gif) => (
        <div
          key={gif.id}
          onClick={() => onSelect(gif)}
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
  );
}
