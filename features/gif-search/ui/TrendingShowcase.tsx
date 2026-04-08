"use client";

import { useState, useEffect } from "react";
import type { Gif } from "@/entities/gif/model";
import { getGifUrl } from "@/entities/gif/model";

type Props = {
  gifs: Gif[];
  onCompose: (gif: Gif) => void;
};

function ConfirmModal({
  gif,
  onConfirm,
  onCancel,
}: {
  gif: Gif;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-[#1a1a1a] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 overflow-hidden rounded-2xl">
          <img src={getGifUrl(gif, "md")} alt={gif.title} className="w-full object-cover" />
        </div>
        <p className="mb-1 text-center text-lg font-bold text-white">이 GIF로 합성해봐요!</p>
        <p className="mb-5 text-center text-sm text-white/40">{gif.title}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-white/20 py-3 text-sm font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-700"
          >
            네, 만들기
          </button>
        </div>
      </div>
    </div>
  );
}

const FEATURED_RESULTS = [
  { src: "/insung_hwang.gif", alt: "합성 결과 예시 1" },
  { src: "/punch_pepe_hwang.gif", alt: "합성 결과 예시 2" },
  { src: "/punch_pepe_podo.gif", alt: "합성 결과 예시 3" },
];

export function TrendingShowcase({ gifs, onCompose }: Props) {
  const allGifs = gifs.slice(0, 7);
  const gridGifs = gifs.slice(0, 4);
  const slideGifs = gifs.slice(4, 7);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [featuredSlide, setFeaturedSlide] = useState(0);
  const [preview, setPreview] = useState<Gif | null>(null);

  useEffect(() => {
    if (allGifs.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % allGifs.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [allGifs.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFeaturedSlide((prev) => (prev + 1) % FEATURED_RESULTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <section className="bg-purple-600 px-4 py-5">
        <div className="mx-auto max-w-screen-xl">
          <p className="mb-3 text-2xl font-bold text-white">새로운 밈을 만들어봐요</p>

          {/* 모바일: 좌우 2열 */}
          <div className="flex gap-3 md:hidden">
            {/* 왼쪽: 트렌딩 슬라이드 */}
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-xs font-semibold text-white/70">지금 많이 사용되는 GIF</p>
              <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "1/1" }}>
                {allGifs.map((gif, i) => (
                  <div
                    key={gif.id}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      i === currentSlide ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <img
                      src={getGifUrl(gif, "md")}
                      alt={gif.title}
                      onClick={() => setPreview(gif)}
                      className="h-full w-full cursor-pointer object-contain"
                    />
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <button
                        onClick={() => setPreview(gif)}
                        className="rounded-full bg-purple-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-900"
                      >
                        나도 만들기
                      </button>
                    </div>
                  </div>
                ))}
                <div className="absolute bottom-3 right-3 flex gap-1">
                  {allGifs.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentSlide ? "w-4 bg-white" : "w-1.5 bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 오른쪽: 결과물 예시 */}
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-xs font-semibold text-white/70">이렇게 만들 수 있어요</p>
              <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "1/1" }}>
                {FEATURED_RESULTS.map((item, i) => (
                  <div
                    key={i}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      i === featuredSlide ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <img src={item.src} alt={item.alt} className="h-full w-full object-contain" />
                  </div>
                ))}
                <div className="absolute bottom-3 right-3 flex gap-1">
                  {FEATURED_RESULTS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFeaturedSlide(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === featuredSlide ? "w-4 bg-white" : "w-1.5 bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 데스크탑: 트렌딩 + 결과물 예시 */}
          <div className="hidden gap-4 md:flex">
            {/* 왼쪽: 트렌딩 2x2 그리드 */}
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-xs font-semibold text-white/70">지금 많이 사용되는 GIF</p>
              <div className="grid grid-cols-2 gap-1.5">
                {gridGifs.map((gif) => (
                  <div
                    key={gif.id}
                    onClick={() => setPreview(gif)}
                    className="group relative cursor-pointer overflow-hidden rounded-lg"
                  >
                    <img
                      src={getGifUrl(gif, "sm")}
                      alt={gif.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute bottom-2 left-2.5 text-sm font-bold text-white line-clamp-1">
                      {gif.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 오른쪽: 결과물 예시 슬라이드 */}
            <div className="flex w-[38%] flex-col gap-2">
              <p className="text-xs font-semibold text-white/70">이렇게 만들 수 있어요</p>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black">
                {FEATURED_RESULTS.map((item, i) => (
                  <div
                    key={i}
                    className={`absolute inset-0 transition-opacity duration-700 ${
                      i === featuredSlide ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <img src={item.src} alt={item.alt} className="h-full w-full object-contain" />
                  </div>
                ))}
                <div className="absolute bottom-3 right-3 flex gap-1">
                  {FEATURED_RESULTS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setFeaturedSlide(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === featuredSlide ? "w-4 bg-white" : "w-1.5 bg-white/40"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {preview && (
        <ConfirmModal
          gif={preview}
          onConfirm={() => {
            onCompose(preview);
            setPreview(null);
          }}
          onCancel={() => setPreview(null)}
        />
      )}
    </>
  );
}
