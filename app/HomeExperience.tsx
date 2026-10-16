"use client";

import { useState, useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronUpIcon } from "@radix-ui/react-icons";
import { Header } from "@/shared/ui/Header";
import { Footer } from "@/shared/ui/Footer";
import { HeroOnboarding } from "@/features/onboarding/ui/HeroOnboarding";
import { ComposeBar } from "@/features/compose/ui/ComposeBar";
import { LoginModal } from "@/features/auth/ui/LoginModal";
import { NewUserWelcomeModal } from "@/features/auth/ui/NewUserWelcomeModal";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import type { Gif } from "@/entities/gif/model";
import { safeParseGif } from "@/entities/gif/model";
import { GifExplorer } from "@/features/gif-search/ui/GifExplorer";
import { useAuth } from "@/shared/lib/use-auth";
import { trackEvent, trackEventOnce } from "@/shared/lib/umami";
import { journeyContext } from "@/shared/lib/journey";
import { useContainedScroll } from "@/shared/ui/use-contained-scroll";
import { useHomeStage } from "./use-home-stage";
import styles from "./home.module.css";

export function HomeExperience({ browsing }: { browsing: boolean }) {
  const router = useRouter();
  const { isLoggedIn, checked } = useAuth();
  const [selectedGif, setSelectedGif] = useState<Gif | null>(null);
  const [listSource, setListSource] = useState("trending");
  const [showLogin, setShowLogin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const stage = useHomeStage(browsing);
  const stageRef = useRef<HTMLElement>(null);
  const examples = useRef<HTMLDivElement>(null);
  const returnButton = useRef<HTMLButtonElement>(null);
  useContainedScroll(examples, { gain: 1, onBoundary: stage.onBoundary });

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    stageRef.current?.focus({ preventScroll: true });
  }, [browsing]);

  function stageKey(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, dialog, [data-gif-sidebar]")) return;
    const host = browsing ? event.currentTarget.querySelector<HTMLElement>("[data-gif-scroll-container]") : examples.current;
    if (!host) return;
    if (browsing && event.key === "PageUp" && host.scrollTop <= 1) {
      event.preventDefault(); stage.revealReturn();
      requestAnimationFrame(() => returnButton.current?.focus({ preventScroll: true }));
    } else if (!browsing && event.key === "PageDown" && host.scrollTop + host.clientHeight >= host.scrollHeight - 1) {
      event.preventDefault(); stage.go(true);
    }
  }

  useEffect(() => {
    const flowId = journeyContext().flow_id;
    trackEventOnce(`home:${flowId}`, "home_viewed");
    const firstAction = (event: Event) => {
      trackEventOnce(`home_action:${flowId}`, "home_first_action", { action: event.type });
    };
    const mediaEvent = (event: Event) => {
      if (!(event.target instanceof HTMLImageElement || event.target instanceof HTMLVideoElement)) return;
      const section = event.target.closest<HTMLElement>("[data-journey-section]")?.dataset.journeySection;
      if (section) trackEventOnce(`home_media:${flowId}:${section}:${event.type}`, event.type === "error" ? "home_media_failed" : "home_media_loaded", { section });
    };
    document.addEventListener("pointerdown", firstAction, { once: true });
    document.addEventListener("keydown", firstAction, { once: true });
    window.addEventListener("scroll", firstAction, { once: true });
    document.addEventListener("load", mediaEvent, true);
    document.addEventListener("loadeddata", mediaEvent, true);
    document.addEventListener("error", mediaEvent, true);
    return () => {
      document.removeEventListener("pointerdown", firstAction);
      document.removeEventListener("keydown", firstAction);
      window.removeEventListener("scroll", firstAction);
      document.removeEventListener("load", mediaEvent, true);
      document.removeEventListener("loadeddata", mediaEvent, true);
      document.removeEventListener("error", mediaEvent, true);
    };
  }, []);

  useEffect(() => {
    const flowId = journeyContext().flow_id;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = (entry.target as HTMLElement).dataset.journeySection!;
        if (entry.isIntersecting) trackEventOnce(`home_section:${flowId}:${section}`, "home_section_viewed", { section });
      }
    });
    document.querySelectorAll("[data-journey-section]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [browsing]);

  useEffect(() => {
    if (sessionStorage.getItem("is_new_user") === "true") {
      sessionStorage.removeItem("is_new_user");
      const timer = window.setTimeout(() => setShowWelcome(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  // 로그인 후 복귀 처리 (pending_action)
  useEffect(() => {
    if (!checked) return;

    const pendingGif = localStorage.getItem("pending_gif");
    const action = localStorage.getItem("pending_action");

    if (action === "compose" && isLoggedIn) {
      localStorage.removeItem("pending_action");
      if (pendingGif) {
        localStorage.setItem("compose_gif", pendingGif);
        localStorage.removeItem("pending_gif");
      }
      router.push("/compose");
    } else if (pendingGif) {
      const gif = safeParseGif(pendingGif);
      localStorage.removeItem("pending_gif");
      if (gif) {
        const timer = window.setTimeout(() => setSelectedGif(gif), 0);
        router.replace("/?browse=1");
        return () => window.clearTimeout(timer);
      }
    }
  }, [checked, isLoggedIn, router]);

  function goCompose(gif?: Gif) {
    const gifToUse = gif ?? selectedGif;
    trackEvent("make_intent", { source: "gif_list", gif_selected: Boolean(gifToUse) });
    if (gifToUse) {
      localStorage.setItem("compose_gif", JSON.stringify(gifToUse));
    }
    router.push("/compose");
  }

  function clearSelection() {
    trackEvent("gif_selection_changed", { action: "cleared", source: listSource, surface: "home", control: "selection_bar" });
    const choices = stageRef.current!.querySelectorAll<HTMLButtonElement>("[data-gif-id]");
    const selected = Array.from(choices).find(choice => choice.dataset.gifId === selectedGif?.id);
    (selected ?? stageRef.current!.querySelector<HTMLInputElement>('input[type="search"]'))?.focus({ preventScroll: true });
    setSelectedGif(null);
  }

  return (
    <div className={`first-experience ${styles.home}`}>
      <Header firstExperience={!isLoggedIn} action={<HeaderActions compact={!isLoggedIn} onLogin={() => setShowLogin(true)} />} />
      {browsing && stage.returnReady && <button ref={returnButton} type="button" className={styles.returnToExamples} aria-label="첫 화면으로 돌아가기" title="첫 화면으로 돌아가기" onClick={() => stage.go(false)}><ChevronUpIcon aria-hidden="true" /></button>}
      <main ref={stageRef} tabIndex={-1} className={styles.stage} data-home-stage={browsing ? "browse" : "examples"} onKeyDown={stageKey}>
        <div key={browsing ? "browse" : "examples"} className={browsing ? styles.enterBrowse : styles.enterExamples}>
          <div className={styles.pulled} style={{ "--stage-pull": `${stage.pull}px` } as CSSProperties}>
            {browsing ? <div id="chooser" tabIndex={-1} data-journey-section="gif_list" className={styles.browser}>
              <GifExplorer surface="home" selectedId={selectedGif?.id ?? null} onSelect={setSelectedGif} onSourceChange={setListSource} onBoundary={stage.onBoundary} footer={<Footer embedded />}
                selectionBar={selectedGif && <ComposeBar selectedGif={selectedGif} onCompose={goCompose} onClear={clearSelection} />} />
            </div> : <div ref={examples} className={styles.examples} data-contained-scroll tabIndex={-1}>
              <HeroOnboarding onStart={story => {
                trackEvent("hero_cta_clicked", { action: "compose", example: story.id });
                trackEvent("make_intent", { source: "onboarding_example", example: story.id });
                router.push(`/compose?example=${encodeURIComponent(story.id)}`);
              }} />
            </div>}
          </div>
        </div>
      </main>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} pendingGif={selectedGif} />}
      {showWelcome && <NewUserWelcomeModal onClose={() => setShowWelcome(false)} />}
    </div>
  );
}
