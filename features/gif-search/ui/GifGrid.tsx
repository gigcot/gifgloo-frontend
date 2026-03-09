"use client";

import type { Gif } from "@/entities/gif/model";

const MOCK_GIFS: Gif[] = Array.from({ length: 24 }, (_, i) => ({
  id: `gif-${i}`,
  url: `https://picsum.photos/seed/${i + 10}/300/${180 + (i % 3) * 40}`,
  title: `GIF ${i + 1}`,
}));

type Props = {
  selectedId: string | null;
  onSelect: (gif: Gif) => void;
};

export function GifGrid({ selectedId, onSelect }: Props) {
  return (
    <div className="columns-2 gap-2 sm:columns-3 md:columns-4 lg:columns-5">
      {MOCK_GIFS.map((gif) => (
        <div
          key={gif.id}
          onClick={() => onSelect(gif)}
          className={`mb-2 cursor-pointer overflow-hidden rounded-lg transition-all ${
            selectedId === gif.id
              ? "ring-2 ring-purple-500 ring-offset-1 ring-offset-[#0d0d0d]"
              : "hover:opacity-80"
          }`}
        >
          <img src={gif.url} alt={gif.title} className="w-full object-cover" />
        </div>
      ))}
    </div>
  );
}
