"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useHomeStage(browsing: boolean) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [returnReady, setReturnReady] = useState(false);
  const pressure = useRef(0);
  const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lockedUntil = useRef(0);

  const go = useCallback((next: boolean) => {
    if (performance.now() < lockedUntil.current) return;
    lockedUntil.current = performance.now() + 900;
    pressure.current = 0;
    clearTimeout(release.current);
    setPull(0);
    setReturnReady(false);
    router.push(next ? "/?browse=1" : "/", { scroll: false });
  }, [router]);

  const revealReturn = useCallback(() => {
    pressure.current = 0;
    clearTimeout(release.current);
    setPull(0);
    setReturnReady(true);
  }, []);

  const onBoundary = useCallback((delta: number) => {
    clearTimeout(release.current);
    if (performance.now() < lockedUntil.current) return;
    const direction = browsing ? -1 : 1;
    if (delta * direction <= 0) {
      pressure.current = 0;
      setPull(0);
      setReturnReady(false);
      return;
    }
    if (browsing && returnReady) return;
    pressure.current += Math.abs(delta);
    if (pressure.current >= 360) {
      if (browsing) revealReturn();
      else go(true);
      return;
    }
    setPull(-direction * pressure.current / 360 * 32);
    release.current = setTimeout(() => { pressure.current = 0; setPull(0); }, 300);
  }, [browsing, go, returnReady, revealReturn]);

  useEffect(() => () => clearTimeout(release.current), []);
  return { go, onBoundary, pull, returnReady, revealReturn };
}
