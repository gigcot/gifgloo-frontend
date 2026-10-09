"use client";

import { useEffect, useRef } from "react";
import type { Gif } from "@/entities/gif/model";
import { GifExplorer } from "./GifExplorer";

type Props = { selectedId: string | null; onSelect: (gif: Gif) => void; onClose: () => void };

export function GifSearchSheet({ selectedId, onSelect, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropDown = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);

  function outside(event: { clientX: number; clientY: number }) {
    const bounds = dialogRef.current!.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }

  return <dialog ref={dialogRef} aria-labelledby="gif-search-heading"
    className="gif-search-dialog first-experience"
    onCancel={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose(); } }}
    onPointerDown={event => { backdropDown.current = event.target === event.currentTarget && outside(event); }}
    onClick={event => { if (backdropDown.current && event.target === event.currentTarget && outside(event)) onClose(); backdropDown.current = false; }}>
    <div className="flex items-center justify-between gap-4 pb-4"><h2 id="gif-search-heading" className="text-xl font-bold">GIF 고르기</h2>
      <button type="button" onClick={onClose} autoFocus className="rounded-full border border-white/30 px-4 py-2">닫기</button>
    </div>
    <GifExplorer selectedId={selectedId} onSelect={onSelect} surface="compose" />
  </dialog>;
}
