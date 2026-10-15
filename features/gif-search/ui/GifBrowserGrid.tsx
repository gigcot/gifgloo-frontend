"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import type { Gif } from "@/entities/gif/model";
import { GifMedia } from "@/entities/gif/ui/GifMedia";
import styles from "./GifExplorer.module.css";

export function GifBrowserGrid({ gifs, selectedId, onChoose, actionLabel, loading }: { gifs: Gif[]; selectedId: string | null; onChoose: (gif: Gif) => void; actionLabel: "선택" | "미리보기"; loading: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [columnWidth, setColumnWidth] = useState(180);
  useEffect(() => {
    const grid = ref.current!;
    const observer = new ResizeObserver(() => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      setColumnWidth((grid.clientWidth - (columns - 1) * 10) / columns);
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} data-testid="gif-results" className={styles.grid} aria-busy={loading}>
    {loading ? Array.from({ length: 15 }, (_, index) => <div key={index} className={styles.skeleton} style={{ gridRowEnd: `span ${12 + index % 3 * 4}` }} />)
      : gifs.map(gif => {
        const media = gif.file.sm.mp4 ?? gif.file.sm.webp ?? gif.file.sm.gif ?? gif.file.md.mp4 ?? gif.file.md.gif;
        const ratio = media?.width && media?.height ? media.height / media.width : 1;
        return <button key={gif.id} type="button" className={`${styles.tile} gif-choice`} data-gif-id={gif.id}
          style={{ gridRowEnd: `span ${Math.ceil((columnWidth * ratio + 10) / 14)}`, aspectRatio: "auto" }}
          aria-label={`${gif.title} ${actionLabel}`} aria-pressed={selectedId === gif.id} onClick={event => { event.currentTarget.focus({ preventScroll: true }); onChoose(gif); }}>
          <GifMedia gif={gif} alt={gif.title} className={styles.tileMedia} containerClassName={styles.tileMediaBox} />
          <span className={styles.tileCaption}>{selectedId === gif.id ? "선택한 장면" : actionLabel === "선택" ? "이 장면 선택" : "이 장면 크게 보기"}</span>
          {selectedId === gif.id && <span className={styles.selectedMark}><CheckIcon aria-hidden="true" /></span>}
        </button>;
      })}
  </div>;
}
