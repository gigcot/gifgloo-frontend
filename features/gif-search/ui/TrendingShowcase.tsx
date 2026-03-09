"use client";

import { useState, useEffect } from "react";

const SHOWCASE_GRID = [
  { url: "https://picsum.photos/seed/101/200/150", label: "😂 Funny" },
  { url: "https://picsum.photos/seed/102/200/150", label: "🔥 Hot" },
  { url: "https://picsum.photos/seed/103/200/150", label: "💜 Love" },
  { url: "https://picsum.photos/seed/104/200/150", label: "🎉 Party" },
];

const SHOWCASE_SLIDES = [
  { url: "https://picsum.photos/seed/201/400/300", label: "✨ gifgloo로 만든 합성" },
  { url: "https://picsum.photos/seed/202/400/300", label: "🎭 내 얼굴이 GIF 속으로" },
  { url: "https://picsum.photos/seed/203/400/300", label: "🚀 지금 바로 만들어봐" },
];

type Props = {
  onCompose: () => void;
};

type PreviewItem = { url: string; label: string };

function ConfirmModal({
  item,
  onConfirm,
  onCancel,
}: {
  item: PreviewItem;
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
          <img src={item.url} alt={item.label} className="w-full object-cover" />
        </div>
        <p className="mb-1 text-center text-lg font-bold text-white">이걸로 할까요?</p>
        <p className="mb-5 text-center text-sm text-white/40">{item.label}</p>
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

export function TrendingShowcase({ onCompose }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SHOWCASE_SLIDES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  function handleSelect(item: PreviewItem) {
    setPreview(item);
  }

  return (
    <>
      <section className="bg-purple-600 px-4 py-5">
        <div className="mx-auto max-w-screen-xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-white/80">
            Trending GIFs &amp; more
          </p>
          <div className="flex gap-2">
            {/* 왼쪽: 2x2 그리드 */}
            <div className="grid flex-1 grid-cols-2 gap-1.5">
              {SHOWCASE_GRID.map((item) => (
                <div
                  key={item.label}
                  onClick={() => handleSelect(item)}
                  className="group relative cursor-pointer overflow-hidden rounded-lg"
                >
                  <img
                    src={item.url}
                    alt={item.label}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2 left-2.5 text-sm font-bold text-white">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* 오른쪽: 자동 슬라이드 */}
            <div className="relative w-[42%] overflow-hidden rounded-lg">
              {SHOWCASE_SLIDES.map((slide, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    i === currentSlide ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  <img
                    src={slide.url}
                    alt={slide.label}
                    onClick={() => handleSelect(slide)}
                    className="h-full w-full cursor-pointer object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-base font-bold leading-snug text-white">{slide.label}</p>
                    <button
                      onClick={() => handleSelect(slide)}
                      className="mt-2 rounded-full bg-purple-800 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-purple-900"
                    >
                      이걸로 만들기
                    </button>
                  </div>
                </div>
              ))}

              <div className="absolute bottom-3 right-3 flex gap-1">
                {SHOWCASE_SLIDES.map((_, i) => (
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
        </div>
      </section>

      {preview && (
        <ConfirmModal
          item={preview}
          onConfirm={() => { setPreview(null); onCompose(); }}
          onCancel={() => setPreview(null)}
        />
      )}
    </>
  );
}
