"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/shared/ui/Header";
import { TrendingShowcase } from "@/features/gif-search/ui/TrendingShowcase";
import { SearchBar } from "@/features/gif-search/ui/SearchBar";
import { GifGrid } from "@/features/gif-search/ui/GifGrid";
import { ComposeBar } from "@/features/compose/ui/ComposeBar";
import { LoginModal } from "@/features/auth/ui/LoginModal";
import { NewUserWelcomeModal } from "@/features/auth/ui/NewUserWelcomeModal";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import type { Gif } from "@/entities/gif/model";
import { safeParseGif } from "@/entities/gif/model";
import { fetchTrendingPage } from "@/shared/api/klipy";
import { useAuth } from "@/shared/lib/use-auth";

export default function Home() {
  const router = useRouter();
  const { isLoggedIn, checked, checkAuth } = useAuth();
  const [selectedGif, setSelectedGif] = useState<Gif | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [trendingGifs, setTrendingGifs] = useState<Gif[]>([]);
  const [trendingError, setTrendingError] = useState(false);
  const [trendingPage, setTrendingPage] = useState(1);
  const [trendingHasMore, setTrendingHasMore] = useState(false);
  const [trendingLoadingMore, setTrendingLoadingMore] = useState(false);

  useEffect(() => {
    fetchTrendingPage(1, 24)
      .then((result) => {
        setTrendingGifs(result.items);
        setTrendingPage(result.currentPage);
        setTrendingHasMore(result.hasNext);
      })
      .catch(() => setTrendingError(true));
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("is_new_user") === "true") {
      sessionStorage.removeItem("is_new_user");
      setShowWelcome(true);
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
      if (gif) setSelectedGif(gif);
      localStorage.removeItem("pending_gif");
    }
  }, [checked, isLoggedIn, router]);

  async function goCompose(gif?: Gif) {
    const loggedIn = await checkAuth();
    if (!loggedIn) {
      localStorage.setItem("pending_action", "compose");
      setShowLogin(true);
      return;
    }
    const gifToUse = gif ?? selectedGif;
    if (gifToUse) {
      localStorage.setItem("compose_gif", JSON.stringify(gifToUse));
    }
    router.push("/compose");
  }

  function handleSelectGif(gif: Gif) {
    setSelectedGif((prev) => (prev?.id === gif.id ? null : gif));
  }

  function loadMoreTrending() {
    if (trendingLoadingMore || !trendingHasMore) return;

    setTrendingLoadingMore(true);
    fetchTrendingPage(trendingPage + 1, 24)
      .then((result) => {
        setTrendingGifs((prev) => [...prev, ...result.items]);
        setTrendingPage(result.currentPage);
        setTrendingHasMore(result.hasNext);
      })
      .catch(() => setTrendingError(true))
      .finally(() => setTrendingLoadingMore(false));
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header action={<HeaderActions onLogin={() => setShowLogin(true)} />} />
      <TrendingShowcase gifs={trendingGifs.slice(0, 7)} onCompose={goCompose} />

      <div className="border-b border-white/10 bg-[#111113] px-4 py-5">
        <div className="mx-auto max-w-screen-xl">
          <p className="text-lg font-semibold text-white">합성할 GIF를 찾아보세요</p>
          <p className="mt-1 text-sm text-white/40">마음에 드는 GIF를 선택하고 내 사진과 합성해봐요</p>
        </div>
      </div>

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <main className={`mx-auto max-w-screen-xl px-4 py-4 ${selectedGif ? "pb-28" : ""}`}>
        {trendingError && trendingGifs.length === 0 && !searchQuery ? (
          <p className="py-12 text-center text-white/40">GIF를 불러오지 못했어요. 새로고침해 주세요.</p>
        ) : (
          <GifGrid
            query={searchQuery}
            trendingGifs={trendingGifs}
            trendingHasMore={trendingHasMore}
            trendingLoadingMore={trendingLoadingMore}
            selectedId={selectedGif?.id ?? null}
            onSelect={handleSelectGif}
            onLoadMoreTrending={loadMoreTrending}
          />
        )}
      </main>

      <ComposeBar selectedGif={selectedGif} onCompose={goCompose} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} pendingGif={selectedGif} />}
      {showWelcome && <NewUserWelcomeModal onClose={() => setShowWelcome(false)} />}
    </div>
  );
}
