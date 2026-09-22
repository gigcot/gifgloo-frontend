"use client";

import { useState, useEffect } from "react";
import type { Gif } from "@/entities/gif/model";
import { GifMedia } from "@/entities/gif/ui/GifMedia";
import { trackEvent } from "@/shared/lib/umami";

type Props = {
  gifs: Gif[];
  onCompose: (gif: Gif) => void;
};

function LandingStep({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex min-w-0 flex-col items-center rounded-xl border border-white/15 bg-white/10 px-2 py-3 text-center backdrop-blur-sm sm:flex-row sm:gap-3 sm:px-3 sm:text-left">
      <span className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-purple-700 shadow-sm sm:mb-0">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-white sm:text-sm">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-white/60 sm:text-xs">{description}</span>
      </span>
    </li>
  );
}

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#111113] p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-black">
          <GifMedia
            gif={gif}
            size="md"
            alt={gif.title}
            eager
            className="h-full w-full object-cover"
          />
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
            className="flex-1 rounded-full bg-purple-600 py-3 text-sm font-bold text-white transition-colors hover:bg-purple-500"
          >
            네, 만들기
          </button>
        </div>
      </div>
    </div>
  );
}

const FEATURED_RESULTS = [
  { src: "/punch_pepe_podo.mp4", alt: "반려동물 합성 결과 예시" },
];

const HEADLINE_SUBJECTS = ["우리 집 반려동물을", "내 친구를", "나를"];

export function TrendingShowcase({ gifs, onCompose }: Props) {
  const allGifs = gifs.slice(0, 7);
  const gridGifs = gifs.slice(0, 4);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [headlineSubjectIndex, setHeadlineSubjectIndex] = useState(0);
  const [headlineAnimating, setHeadlineAnimating] = useState(false);
  const [preview, setPreview] = useState<Gif | null>(null);
  const currentGif = allGifs.length > 0
    ? allGifs[currentSlide % allGifs.length]
    : null;
  const currentFeatured = FEATURED_RESULTS[0];

  function handleLandingCta() {
    trackEvent("landing_cta_clicked", { location: "hero" });
    document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    if (allGifs.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % allGifs.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [allGifs.length]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setHeadlineAnimating(true);
      transitionTimer = setTimeout(() => {
        setHeadlineSubjectIndex((prev) => (prev + 1) % HEADLINE_SUBJECTS.length);
        setHeadlineAnimating(false);
      }, 480);
    }, 2800);
    return () => {
      clearInterval(interval);
      if (transitionTimer) clearTimeout(transitionTimer);
    };
  }, []);

  return (
    <>
      <section className="bg-purple-600 px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-screen-xl">
          <div className="mb-6 flex flex-col gap-4 lg:items-center lg:text-center">
            <div className="w-full max-w-3xl">
              <p className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/85">
                사진 한 장이면 끝
              </p>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                <span className="sr-only">반려동물, 친구 또는 나를 GIF 주인공으로</span>
                <span aria-hidden="true">
                  <span className="relative block h-[1.2em] overflow-hidden text-left lg:text-center">
                    <span
                      className={`absolute inset-0 block transition-[transform,opacity,filter] ease-out ${
                        headlineAnimating
                          ? "-translate-y-full opacity-0 blur-[2px] duration-[480ms]"
                          : "translate-y-0 opacity-100 blur-0 duration-0"
                      }`}
                    >
                      {HEADLINE_SUBJECTS[headlineSubjectIndex]}
                    </span>
                    <span
                      className={`absolute inset-0 block transition-[transform,opacity,filter] ease-out ${
                        headlineAnimating
                          ? "translate-y-0 opacity-100 blur-0 duration-[480ms]"
                          : "translate-y-full opacity-0 blur-[2px] duration-0"
                      }`}
                    >
                      {HEADLINE_SUBJECTS[(headlineSubjectIndex + 1) % HEADLINE_SUBJECTS.length]}
                    </span>
                  </span>
                  <span className="block whitespace-nowrap text-left lg:text-center">GIF 주인공으로</span>
                </span>
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/75 sm:text-base">
                마음에 드는 GIF를 고르고 사진 한 장을 올리면 AI가 움직이는 밈으로 만들어줘요.
              </p>
              <ol className="mt-4 grid grid-cols-3 gap-2 lg:mx-auto lg:max-w-2xl">
                <LandingStep
                  title="GIF 고르기"
                  description="재밌는 장면 선택"
                  icon={
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                      <rect x="3" y="5" width="18" height="14" rx="3" />
                      <path d="m10 9 5 3-5 3V9Z" className="fill-current stroke-none" />
                    </svg>
                  }
                />
                <LandingStep
                  title="사진 올리기"
                  description="선명한 사진 한 장"
                  icon={
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                      <path d="M12 16V4m0 0L8 8m4-4 4 4" />
                      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                    </svg>
                  }
                />
                <LandingStep
                  title="결과 확인"
                  description="저장하고 공유"
                  icon={
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                      <path d="m12 3 1.35 4.15L17.5 8.5l-4.15 1.35L12 14l-1.35-4.15L6.5 8.5l4.15-1.35L12 3Z" />
                      <path d="m18.5 14 .75 2.25L21.5 17l-2.25.75L18.5 20l-.75-2.25L15.5 17l2.25-.75.75-2.25Z" />
                    </svg>
                  }
                />
              </ol>
            </div>
            <button
              type="button"
              onClick={handleLandingCta}
              className="w-full shrink-0 rounded-full bg-white px-6 py-3 text-sm font-bold text-purple-700 shadow-lg shadow-purple-950/20 transition-transform hover:-translate-y-0.5 hover:bg-purple-50 sm:w-auto"
            >
              GIF 골라보기
            </button>
          </div>

          {/* 모바일: 좌우 2열 */}
          <div className="flex gap-3 lg:hidden">
            {/* 왼쪽: 트렌딩 슬라이드 */}
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-xs font-semibold text-white/70">지금 많이 사용되는 GIF</p>
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl" style={{ aspectRatio: "1/1" }}>
                {currentGif && (
                  <div className="absolute inset-0">
                    <button
                      type="button"
                      onClick={() => setPreview(currentGif)}
                      className="h-full w-full"
                    >
                      <GifMedia
                        gif={currentGif}
                        size="md"
                        alt={currentGif.title}
                        eager
                        className="h-full w-full object-contain"
                      />
                    </button>
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <button
                        onClick={() => setPreview(currentGif)}
                        className="rounded-full bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-purple-500"
                      >
                        나도 만들기
                      </button>
                    </div>
                  </div>
                )}
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
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl" style={{ aspectRatio: "1/1" }}>
                <video
                  src={currentFeatured.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  aria-label={currentFeatured.alt}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>

          {/* 데스크탑: 트렌딩 + 결과물 예시 */}
          <div className="hidden gap-3 lg:grid lg:grid-cols-5">
            {/* 왼쪽: 트렌딩 한 줄 그리드 */}
            <div className="col-span-4 flex flex-col gap-2">
              <p className="text-xs font-semibold text-white/70">지금 많이 사용되는 GIF</p>
              <div className="grid grid-cols-4 gap-3">
                {gridGifs.map((gif) => (
                  <button
                    type="button"
                    key={gif.id}
                    onClick={() => setPreview(gif)}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black text-left shadow-xl"
                  >
                    <GifMedia
                      gif={gif}
                      size="sm"
                      alt={gif.title}
                      eager
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute bottom-2 left-2.5 text-sm font-bold text-white line-clamp-1">
                      {gif.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 오른쪽: 결과물 예시 슬라이드 */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-white/70">이렇게 만들 수 있어요</p>
              <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
                <video
                  src={currentFeatured.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  aria-label={currentFeatured.alt}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {preview && (
        <ConfirmModal
          gif={preview}
          onConfirm={() => {
            trackEvent("gif_selected", { source: "featured" });
            onCompose(preview);
            setPreview(null);
          }}
          onCancel={() => setPreview(null)}
        />
      )}
    </>
  );
}
