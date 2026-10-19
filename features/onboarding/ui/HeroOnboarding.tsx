"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRightIcon, ChevronDownIcon, ChevronRightIcon, Cross2Icon, PauseIcon, PlayIcon, PlusIcon } from "@radix-ui/react-icons";
import { trackEvent } from "@/shared/lib/umami";
import { onboardingStories, type OnboardingStory } from "../model/stories";
import styles from "./HeroOnboarding.module.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function StoryMedia({ src, alt, poster, motion }: { src: string; alt: string; poster?: string; motion: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (motion) void video.play().catch((error: DOMException) => {
      if (error.name !== "AbortError" && error.name !== "NotAllowedError") setFailed(true);
    });
    else video.pause();
  }, [motion, src]);
  return <>
    {src.endsWith(".mp4")
      ? <video ref={videoRef} src={src} poster={poster} muted loop playsInline preload="metadata" aria-label={alt} onError={() => setFailed(true)} />
      : <img src={src} alt={alt} onError={() => setFailed(true)} />}
    {failed && <span className={styles.mediaNotice} role="status">예시를 불러오지 못했어요.</span>}
  </>;
}

export function HeroOnboarding({ onStart }: { onStart: (story: OnboardingStory) => void }) {
  const [position, setPosition] = useState({ story: 0, phase: 0 });
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [playOverride, setPlayOverride] = useState(false);
  const [userPlayed, setUserPlayed] = useState(false);
  const [inView, setInView] = useState(true);
  const [howOpen, setHowOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const elapsed = useRef(0);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => true);
  const story = onboardingStories[position.story];
  const phase = story.phases[position.phase];
  const motion = !reducedMotion || userPlayed;
  const rotationPaused = paused || !motion;

  function advance() {
    elapsed.current = 0;
    setPosition(current => current.phase + 1 < onboardingStories[current.story].phases.length
      ? { ...current, phase: current.phase + 1 }
      : { story: (current.story + 1) % onboardingStories.length, phase: 0 });
  }

  function pause() { setPaused(true); setPlayOverride(false); }

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .25 });
    const stage = stageRef.current;
    if (stage) observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!howOpen) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${Number.parseFloat(getComputedStyle(body).paddingRight) + scrollbarWidth}px`;
    }
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [howOpen]);

  useEffect(() => {
    if (rotationPaused || (hovering && !playOverride) || !inView || howOpen) return;
    let lastTick = performance.now();
    let frame = 0;
    function tick(now: number) {
      const delta = Math.min(now - lastTick, 250);
      lastTick = now;
      if (!document.hidden) elapsed.current += delta;
      if (elapsed.current >= phase.duration) {
        elapsed.current = 0;
        setPosition(current => current.phase + 1 < onboardingStories[current.story].phases.length
          ? { ...current, phase: current.phase + 1 }
          : { story: (current.story + 1) % onboardingStories.length, phase: 0 });
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rotationPaused, hovering, playOverride, inView, howOpen, phase]);

  function openHow() {
    pause();
    setHowOpen(true);
    dialogRef.current?.showModal();
  }

  function start() {
    pause();
    dialogRef.current?.close();
    trackEvent("home_choose_gif_clicked");
    onStart(story);
  }

  const phaseName = { source: "원본과 사진", result: "합성 결과", chat: "대화에서 사용" }[phase.name];

  return <section className={styles.hero} aria-label="개인화 GIF 예시" data-journey-section="examples">
    <div role="group" aria-roledescription="캐러셀" aria-label="GIF를 사용하는 이야기"
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovering(true); }}
      onPointerLeave={() => { setHovering(false); setPlayOverride(false); }}
      onPointerDown={event => { if (!(event.target as HTMLElement).closest("[data-rotation]")) pause(); }}
      onFocus={event => { if (!(event.target as HTMLElement).closest("[data-rotation]")) pause(); }}>
      <div className={styles.headline}><h1>{phase.title[0]}<br /><em>{phase.title[1]}</em>{phase.title[2]}</h1></div>
      <div ref={stageRef} className={styles.stage} aria-live={rotationPaused ? "polite" : "off"} aria-atomic="true" aria-label={`예시 ${position.story + 1} / ${onboardingStories.length} · ${phaseName}`}>
        <div key={story.id} className={`${styles.story} ${story.layout === "pet" ? "" : styles[story.layout]}`} data-story={story.id} data-phase={phase.name} data-input-visible={phase.showPhoto !== false}>
          <div className={styles.chat} aria-hidden={phase.name !== "chat"}>
            <span className={styles.chatTitle}>{story.chatTitle}</span>
            {story.prompt && <div className={styles.prompt}><span className={styles.sender}>친구</span><p className={`${styles.bubble} ${styles.incoming}`}>{story.prompt}</p></div>}
            {story.send && <p className={`${styles.bubble} ${styles.outgoing} ${styles.send}`}>{story.send}</p>}
            <div className={styles.replies}>{story.replies.map((reply, index) => <Fragment key={index}>
              {reply.sender && <span className={styles.sender}>{reply.sender}</span>}
              <p className={`${styles.bubble} ${reply.outgoing ? styles.outgoing : styles.incoming}`}>{reply.text}</p>
            </Fragment>)}</div>
          </div>
          <div className={styles.storyMedia}>
            <div className={styles.result} aria-hidden={phase.name === "source"}><StoryMedia src={story.result} alt={story.resultAlt} poster={story.poster} motion={motion && inView && phase.name !== "source"} /></div>
            <div className={styles.source} aria-hidden={phase.name !== "source"}><StoryMedia src={story.sourceVideo} alt={story.sourceAlt} poster={story.sourcePoster} motion={motion && inView && phase.name === "source"} /></div>
          </div>
          <span className={styles.storyLabel}>{phase.label}</span>
          <figure className={styles.photo} aria-hidden={phase.showPhoto === false}>
            <img src={story.target} alt={`짤에 넣은 사진: ${story.targetName}`} />
            <figcaption><strong>{story.targetName}</strong><span>{phase.name === "source" ? "넣을 사진" : "넣은 사진"}</span></figcaption>
          </figure>
        </div>
      </div>
      <div className={styles.footer}>
        <span className={styles.caption}>{phase.caption}</span>
        <div className={styles.controls}>
          <span className={styles.count} aria-hidden="true">{position.story + 1} / {onboardingStories.length}</span>
          <button className={styles.iconButton} data-rotation type="button" aria-label={rotationPaused ? "슬라이드 재생" : "슬라이드 일시정지"} title={rotationPaused ? "슬라이드 재생" : "슬라이드 일시정지"}
            onClick={() => { if (rotationPaused) { setPaused(false); setUserPlayed(true); setPlayOverride(true); } else pause(); }}>
            {rotationPaused ? <PlayIcon aria-hidden="true" /> : <PauseIcon aria-hidden="true" />}
          </button>
          <button className={styles.iconButton} type="button" aria-label="다음 슬라이드" title="다음 슬라이드" onClick={() => { pause(); advance(); trackEvent("home_example_changed", { direction: "next" }); }}><ChevronRightIcon aria-hidden="true" /></button>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.primary} type="button" onClick={start}>나도 만들어볼래요! <ArrowRightIcon aria-hidden="true" /></button>
        <button className={styles.quiet} type="button" onClick={openHow} aria-haspopup="dialog">어떻게 만드나요?</button>
      </div>
    </div>
    <div className={styles.usage}>
      <button className={`${styles.quiet} ${styles.usageToggle}`} type="button" aria-expanded={usageOpen} aria-controls="onboarding-usage"
        onClick={() => { pause(); setUsageOpen(open => !open); }}>
        <span>그래서 이걸 어디에 쓰나요?</span><ChevronDownIcon aria-hidden="true" />
      </button>
      <div id="onboarding-usage" className={styles.usageContent} hidden={!usageOpen}>
        <div>
          <h2>지금 이 대화에 맞는, 우리만의 짤.</h2>
          <p>서로 아는 사람이나 대상, 익숙한 장면을 조합해보세요. 우리끼리 통하는 맥락을 담아, 지금 상황에 딱 맞는 표현을 만들어 공유해보세요.</p>
        </div>
        <div>
          <h2>만들어보는 재미, 간직하는 즐거움.</h2>
          <p>좋아하는 대상을 원하는 장면에 넣어, 보고 싶은 모습을 만들어보세요. 마음에 드는 짤은 간직하며 두고두고 꺼내보세요.</p>
        </div>
      </div>
    </div>
    <p className={styles.footnote}>대화에 보내도, 나만의 짤로 간직해도 좋아요.</p>

    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="onboarding-how-title" aria-describedby="onboarding-how-description"
      onClose={() => setHowOpen(false)} onCancel={() => setHowOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.currentTarget.close();
      }}>
      <div className={styles.dialogTop}><span>이 예시는 이렇게 만들었어요</span><button className={styles.iconButton} type="button" aria-label="만드는 방법 닫기" onClick={() => dialogRef.current?.close()}><Cross2Icon aria-hidden="true" /></button></div>
      <h2 id="onboarding-how-title">장면을 고르고, 사진을 넣으면.</h2>
      <p id="onboarding-how-description" className={styles.description}>{story.description}</p>
      {howOpen && <div className={styles.recipe}>
        <figure><div><StoryMedia src={story.sourceVideo} alt={story.sourceAlt} poster={story.sourcePoster} motion={motion} /></div><figcaption>1. 고른 원본 GIF</figcaption></figure>
        <PlusIcon className={styles.operator} aria-hidden="true" />
        <figure><div><img src={story.target} alt={`짤에 넣은 사진: ${story.targetName}`} /></div><figcaption>2. 넣은 사진</figcaption></figure>
        <ArrowRightIcon className={`${styles.operator} ${styles.resultArrow}`} aria-hidden="true" />
        <figure className={styles.resultFigure}><div><StoryMedia src={story.result} alt={story.resultAlt} poster={story.poster} motion={motion} /></div><figcaption>이렇게 달라졌어요</figcaption></figure>
      </div>}
      <button className={styles.primary} type="button" onClick={start}>내가 만들 장면 고르기 <ArrowRightIcon aria-hidden="true" /></button>
    </dialog>
  </section>;
}
