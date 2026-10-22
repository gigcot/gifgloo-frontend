"use client";

import { useState } from "react";
import { Cross2Icon, EnterFullScreenIcon } from "@radix-ui/react-icons";
import type { Gif } from "@/entities/gif/model";
import { GifMedia } from "@/entities/gif/ui/GifMedia";
import { GifPreviewDialog } from "@/features/gif-search/ui/GifPreviewDialog";
import { trackEvent } from "@/shared/lib/analytics";
import styles from "./ComposeBar.module.css";

export function ComposeBar({ selectedGif, onCompose, onClear }: { selectedGif: Gif; onCompose: (gif: Gif) => void; onClear: () => void }) {
  const [preview, setPreview] = useState(false);

  function choosePhoto() {
    setPreview(false);
    onCompose(selectedGif);
  }

  return <div className={styles.dock}>
    <div className={styles.bar} role="group" aria-label="선택한 GIF">
      <GifMedia gif={selectedGif} alt="선택한 장면" eager className={styles.media} containerClassName={styles.thumbnail} />
      <span className="sr-only" role="status">{selectedGif.title} 선택됨</span>
      <button type="button" className={styles.expand} aria-label="선택한 GIF 크게 보기" title="크게 보기" onClick={() => {
        trackEvent("gif_preview_opened", { surface: "home", control: "selection_bar" });
        setPreview(true);
      }}><EnterFullScreenIcon aria-hidden="true" /><span>크게 보기</span></button>
      <button type="button" className={styles.choose} onClick={choosePhoto}>사진 고르기</button>
      <button type="button" className={styles.clear} aria-label="GIF 선택 취소" title="선택 취소" onClick={onClear}><Cross2Icon aria-hidden="true" /></button>
    </div>
    {preview && <GifPreviewDialog gif={selectedGif} onClose={() => setPreview(false)} onConfirm={choosePhoto} confirmLabel="사진 고르기" />}
  </div>;
}
