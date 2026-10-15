"use client";

import { useEffect, useRef } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { Gif } from "@/entities/gif/model";
import { GifMedia } from "@/entities/gif/ui/GifMedia";
import styles from "./GifExplorer.module.css";

export function GifPreviewDialog({ gif, onClose, onConfirm, confirmLabel = "바꿔볼래요" }: { gif: Gif; onClose: () => void; onConfirm: () => void; confirmLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropDown = useRef(false);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const ownsScrollLock = !dialog.parentElement?.closest("dialog[open]");
    if (ownsScrollLock) document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      if (ownsScrollLock) document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  function outside(event: { clientX: number; clientY: number }) {
    const box = ref.current!.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  }
  return <dialog ref={ref} className={styles.preview} aria-labelledby="gif-preview-title"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onPointerDown={event => { backdropDown.current = event.target === event.currentTarget && outside(event); }}
    onClick={event => { if (backdropDown.current && event.target === event.currentTarget && outside(event)) onClose(); backdropDown.current = false; }}>
    <div className={`${styles.dialogTop} ${styles.previewTop}`}>
      <h2 id="gif-preview-title" className={styles.previewTitle}>대상을 바꿔볼까요?</h2>
      <button type="button" autoFocus aria-label="GIF 미리보기 닫기" onClick={onClose}><Cross2Icon /></button>
    </div>
    <div className={styles.previewStage}>
      <GifMedia gif={gif} size="md" alt={gif.title} eager className={styles.previewMedia} containerClassName={styles.previewMediaBox} />
    </div>
    <p className={styles.mediaTitle}>{gif.title}</p>
    <button type="button" className={styles.confirm} onClick={onConfirm}>{confirmLabel}</button>
  </dialog>;
}
