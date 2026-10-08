"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownIcon, ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon, PlusIcon } from "@radix-ui/react-icons";
import { trackEvent } from "@/shared/lib/umami";
const examples = [
  { id: "dog", name: "강아지", photo: "dog.jpg", alt: "노란 옷을 입은 흰 강아지 사진" },
  { id: "cat", name: "고양이", photo: "cat.jpg", alt: "바퀴 옆에 누워 있는 회색 줄무늬 고양이 사진" },
];
export function HeroExamples() {
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState("");
  const sourceRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef<HTMLVideoElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const example = examples[slide];
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPlaying(!query.matches);
    const timer = setTimeout(update, 0);
    query.addEventListener("change", update);
    return () => { clearTimeout(timer); query.removeEventListener("change", update); };
  }, []);
  useEffect(() => {
    for (const video of [sourceRef.current, resultRef.current]) {
      if (!video) continue;
      if (playing) void video.play().catch(() => setPlaying(false));
      else video.pause();
    }
  }, [playing, slide]);
  function changeSlide(direction: number) {
    setSlide(current => (current + direction + examples.length) % examples.length);
    trackEvent("home_example_changed", { direction: direction > 0 ? "next" : "previous" });
  }
  function goToChooser() {
    const chooser = document.getElementById("chooser");
    chooser?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    chooser?.focus({ preventScroll: true });
    trackEvent("home_choose_gif_clicked");
  }
  return <div data-journey-section="examples">
      <section className="hero" aria-labelledby="hero-title"><div className="hero-inner">
        <h1 id="hero-title">사진 속 주인공을<br />GIF 속으로</h1>
        <section className="example" aria-label="만드는 원리 예시" aria-roledescription="캐러셀"
          onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
          onTouchEnd={(event) => {
            if (!touchStart.current) return;
            const dx = event.changedTouches[0].clientX - touchStart.current.x;
            const dy = event.changedTouches[0].clientY - touchStart.current.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) changeSlide(dx < 0 ? 1 : -1);
            touchStart.current = null;
          }}>
          <div className="inputs">
            <figure><figcaption>원본 GIF</figcaption><video ref={sourceRef} className="input-media" src="/examples/hippo-pets/hippo.mp4" poster="/examples/hippo-pets/hippo-still.png" muted loop playsInline preload="auto" aria-label="물줄기를 맞는 하마 원본 GIF" onError={() => setNotice("원본 예시를 재생하지 못했어요. 아래 GIF 선택은 계속 이용할 수 있어요.")} /></figure>
            <PlusIcon className="plus" aria-hidden="true" />
            <figure><figcaption>넣은 사진</figcaption><img className="input-media" src={`/examples/hippo-pets/${example.photo}`} alt={example.alt} /></figure>
          </div>
          <ArrowDownIcon className="down-arrow" aria-hidden="true" />
          <figure className="result"><figcaption>합성 결과</figcaption><video key={example.id} ref={resultRef} src={`/examples/hippo-pets/${example.id}-result.mp4`} poster={`/examples/hippo-pets/${example.id}-result-still.png`} muted loop playsInline preload="auto" aria-label={`${example.name}가 물을 맞는 실제 합성 결과`} onError={() => setNotice("합성 예시를 재생하지 못했어요. 아래 GIF 선택은 계속 이용할 수 있어요.")} /></figure>
          <div className="carousel-controls">
            <button className="round-button" aria-label="이전 예시" onClick={() => changeSlide(-1)}><ChevronLeftIcon /></button>
            <span className="slide-index" aria-live="polite" aria-atomic="true"><span className="sr-only">{example.name} 예시, </span>{slide + 1} / {examples.length}</span>
            <button className="round-button" aria-label="다음 예시" onClick={() => changeSlide(1)}><ChevronRightIcon /></button>
            <button className="round-button playback" aria-label={playing ? "예시 재생 멈추기" : "예시 재생하기"} onClick={() => setPlaying(!playing)}>{playing ? <PauseIcon /> : <PlayIcon />}</button>
          </div>
        </section>
        <div className="hero-action"><button className="primary" onClick={goToChooser}>GIF 고르기</button><p>가입 없이 처음 2회 무료</p></div>
      </div></section>

    {notice && <p role="status" className="px-5 py-2 text-sm">{notice}</p>}
  </div>;
}
