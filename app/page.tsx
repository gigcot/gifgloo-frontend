"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/shared/ui/Header";
import { TrendingShowcase } from "@/features/gif-search/ui/TrendingShowcase";
import { SearchBar } from "@/features/gif-search/ui/SearchBar";
import { GifGrid } from "@/features/gif-search/ui/GifGrid";
import { ComposeBar } from "@/features/compose/ui/ComposeBar";
import { LoginModal } from "@/features/auth/ui/LoginModal";
import type { Gif } from "@/entities/gif/model";

export default function Home() {
  const router = useRouter();
  const [selectedGif, setSelectedGif] = useState<Gif | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("http://localhost:8000/users/me", {
          credentials: "include",
        });
        setIsLoggedIn(res.ok);

        const pendingGif = localStorage.getItem("pending_gif");
        const action = localStorage.getItem("pending_action");

        if (action === "compose" && res.ok) {
          localStorage.removeItem("pending_action");
          if (pendingGif) {
            localStorage.setItem("compose_gif", pendingGif);
            localStorage.removeItem("pending_gif");
          }
          router.push("/compose");
        } else if (pendingGif) {
          setSelectedGif(JSON.parse(pendingGif));
          localStorage.removeItem("pending_gif");
        }
      } catch {
        setIsLoggedIn(false);
      }
    }

    checkAuth();
  }, []);

  async function goCompose() {
    try {
      const res = await fetch("http://localhost:8000/users/me", {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
    } catch {
      localStorage.setItem("pending_action", "compose");
      setShowLogin(true);
      return;
    }
    if (selectedGif) {
      localStorage.setItem("compose_gif", JSON.stringify(selectedGif));
    }
    router.push("/compose");
  }

  function handleSelectGif(gif: Gif) {
    setSelectedGif((prev) => (prev?.id === gif.id ? null : gif));
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <Header
        action={
          <button
            onClick={() => setShowLogin(true)}
            className="rounded-full bg-purple-600 px-5 py-2 text-base font-semibold text-white transition-colors hover:bg-purple-700"
          >
            로그인
          </button>
        }
      />
      <TrendingShowcase onCompose={goCompose} />
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <main className={`mx-auto max-w-screen-xl px-4 py-4 ${selectedGif ? "pb-28" : ""}`}>
        <GifGrid selectedId={selectedGif?.id ?? null} onSelect={handleSelectGif} />
      </main>

      <ComposeBar selectedGif={selectedGif} onCompose={goCompose} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} pendingGif={selectedGif} />}
    </div>
  );
}
