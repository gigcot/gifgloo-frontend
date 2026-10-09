"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/shared/ui/Header";
import { HeroExamples } from "@/features/gif-search/ui/HeroExamples";
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

export default function Home() {
  const router = useRouter();
  const { isLoggedIn, checked } = useAuth();
  const [selectedGif, setSelectedGif] = useState<Gif | null>(null);
  const [listSource, setListSource] = useState("trending");
  const [showLogin, setShowLogin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const flowId = journeyContext().flow_id;
    trackEventOnce(`home:${flowId}`, "home_viewed");
    const firstAction = (event: Event) => {
      trackEventOnce(`home_action:${flowId}`, "home_first_action", { action: event.type });
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) trackEventOnce(`home_section:${flowId}:${(entry.target as HTMLElement).dataset.journeySection}`, "home_section_viewed", { section: (entry.target as HTMLElement).dataset.journeySection! });
      }
    });
    document.querySelectorAll("[data-journey-section]").forEach((element) => observer.observe(element));
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
      observer.disconnect();
      document.removeEventListener("pointerdown", firstAction);
      document.removeEventListener("keydown", firstAction);
      window.removeEventListener("scroll", firstAction);
      document.removeEventListener("load", mediaEvent, true);
      document.removeEventListener("loadeddata", mediaEvent, true);
      document.removeEventListener("error", mediaEvent, true);
    };
  }, []);

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
        return () => window.clearTimeout(timer);
      }
    }
  }, [checked, isLoggedIn, router]);

  function goCompose(gif?: Gif) {
    const gifToUse = gif ?? selectedGif;
    trackEvent("make_intent", { source: gif ? "featured" : "gif_list", gif_selected: Boolean(gifToUse) });
    if (gifToUse) {
      localStorage.setItem("compose_gif", JSON.stringify(gifToUse));
    }
    router.push("/compose");
  }

  function handleSelectGif(gif: Gif) {
    setSelectedGif((prev) => (prev?.id === gif.id ? null : gif));
  }

  return (
    <div className="first-experience min-h-screen">
      <Header firstExperience={!isLoggedIn} action={<HeaderActions compact={!isLoggedIn} onLogin={() => setShowLogin(true)} />} />
      <HeroExamples />
      <main id="chooser" tabIndex={-1} data-journey-section="gif_list" className="chooser">
        <h2>어떤 GIF로 만들어볼까요?</h2>
        <GifExplorer surface="home" selectedId={selectedGif?.id ?? null} onSelect={handleSelectGif} onSourceChange={setListSource} />
      </main>

      <ComposeBar selectedGif={selectedGif} onCompose={goCompose} onClear={() => {
        trackEvent("gif_selection_changed", { action: "cleared", source: listSource, surface: "home", control: "selection_bar" });
        setSelectedGif(null);
      }} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} pendingGif={selectedGif} />}
      {showWelcome && <NewUserWelcomeModal onClose={() => setShowWelcome(false)} />}
    </div>
  );
}
