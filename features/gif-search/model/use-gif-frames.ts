"use client";
import { useEffect, useSyncExternalStore } from "react";
import { getGifUrl, type Gif } from "@/entities/gif/model";
import { trackEvent } from "@/shared/lib/umami";

export type GifFrame = { status: "loading" | "error" } | { status: "ready"; count: number };
const entries = new Map<string, GifFrame>();
const listeners = new Set<() => void>();
let snapshot: ReadonlyMap<string, GifFrame> = new Map();
const empty: ReadonlyMap<string, GifFrame> = new Map();
const queue: string[] = [];
let active = 0;
function emit() { snapshot = new Map(entries); listeners.forEach(listener => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

function startNext() {
  if (active >= 2 || queue.length === 0) return;
  const url = queue.shift()!;
  active += 1;
  let worker: Worker;
  let settled = false;
  const timer = setTimeout(() => finish({ status: "error" }), 15000);
  function finish(result: GifFrame) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    worker?.terminate();
    active -= 1;
    entries.set(url, result);
    while (entries.size > 80) {
      const removable = [...entries].find(([, frame]) => frame.status !== "loading");
      if (!removable) break;
      entries.delete(removable[0]);
    }
    emit();
    trackEvent("gif_frame_inspected", { status: result.status, ...(result.status === "ready" ? { frame_count: result.count } : {}) });
    startNext();
  }
  try {
    worker = new Worker(new URL("./gif-frame.worker.ts", import.meta.url));
    worker.onmessage = event => finish(event.data as GifFrame);
    worker.onerror = event => { event.preventDefault(); finish({ status: "error" }); };
    worker.postMessage(new URL(url, window.location.origin).href);
  } catch { finish({ status: "error" }); }
}

export function inspectGifFrames(gif: Gif, retry = false) {
  const url = getGifUrl(gif, "hd");
  const existing = entries.get(url);
  if (existing && !(retry && existing.status === "error")) return;
  if (queue.length >= 8) return;
  entries.set(url, { status: "loading" });
  queue.push(url);
  emit();
  startNext();
}

export function useGifFrames() {
  const frames = useSyncExternalStore(subscribe, () => snapshot, () => empty);
  return { frames, inspect: inspectGifFrames };
}

export function useSelectedGifFrame(gif: Gif | null) {
  const { frames } = useGifFrames();
  useEffect(() => { if (gif) inspectGifFrames(gif); }, [gif]);
  return gif ? frames.get(getGifUrl(gif, "hd")) : undefined;
}
