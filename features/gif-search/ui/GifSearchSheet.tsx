"use client";

import { useEffect, useRef, useState } from "react";
import type { Gif } from "@/entities/gif/model";
import { trackEvent } from "@/shared/lib/umami";
import { presetGif, scenePresets, type ScenePreset } from "../model/scene-presets";
import { GifExplorer } from "./GifExplorer";
import { ScenePreview } from "./ScenePreview";
import styles from "./ScenePicker.module.css";

type Props = { selectedId: string | null; onSelect: (gif: Gif) => void; onClose: () => void; initialMode?: "browse" | "search"; photo?: string; hasPhoto?: boolean };

export function GifSearchSheet({ selectedId, onSelect, onClose, initialMode = "browse", photo, hasPhoto }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropDown = useRef(false);
  const [keyword, setKeyword] = useState<ScenePreset | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<string | null>(initialMode === "search" ? "" : null);
  const choices = keyword ? [keyword] : scenePresets.slice(0, 4);
  const photoContext = photo && <div className={styles.context}><img src={photo} alt={hasPhoto ? "유지할 사진" : "예시 사진"} /><p>{hasPhoto ? "사진은 그대로 두고, 장면만 골라요." : "사진은 나중에 바꿔도 돼요."}</p></div>;
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);

  function outside(event: { clientX: number; clientY: number }) {
    const bounds = dialogRef.current!.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }

  return <dialog ref={dialogRef} aria-labelledby="gif-search-heading" className={styles.dialog + " first-experience"}
    onCancel={event => { if (event.target === event.currentTarget) { event.preventDefault(); onClose(); } }}
    onPointerDown={event => { backdropDown.current = event.target === event.currentTarget && outside(event); }}
    onClick={event => { if (backdropDown.current && event.target === event.currentTarget && outside(event)) onClose(); backdropDown.current = false; }}>
    <div className={styles.top}><h2 id="gif-search-heading">{search === null ? "어떤 모습을 만들어볼까요?" : "장면 검색"}</h2><button type="button" onClick={onClose} autoFocus>닫기</button></div>
    {search !== null ? <div className={styles.explorer}>
      <GifExplorer key={search} selectedId={selectedId} onSelect={onSelect} surface="compose" initialSearch={search}
        intro={<>{photoContext}<button type="button" className={styles.back} onClick={() => setSearch(null)}>← 추천 키워드로 돌아가기</button></>} />
    </div> : <>{photoContext}<div className={styles.scroll}>
      <p className={styles.hint}>끌리는 키워드나 장면을 눌러보세요.</p>
      <div className={styles.keywords} role="group" aria-label="추천 검색어">{scenePresets.map(scene => <button type="button" key={scene.id} aria-pressed={keyword?.id === scene.id} onClick={() => {
        setKeyword(current => current?.id === scene.id ? null : scene);
        trackEvent("scene_keyword_selected", { keyword: scene.keyword, scene: scene.id, surface: "compose" });
      }}>{scene.keyword}</button>)}</div>
      <div className={styles.resultsTitle}><h3 aria-live="polite">{keyword ? keyword.keyword + " 장면" : "이런 장면으로 시작해보세요"}</h3>{keyword && <button type="button" onClick={() => setKeyword(null)}>처음 추천 보기</button>}</div>
      <div className={styles.grid} aria-label="장면 미리보기">{choices.map(scene => <button type="button" key={scene.id} className={styles.card} aria-label={scene.title + " 선택"} aria-pressed={selectedId === "preset-" + scene.id} onClick={() => {
        trackEvent("gif_selected", { source: "suggested_scene", surface: "compose", scene: scene.id, keyword: keyword?.keyword ?? "initial" });
        onSelect(presetGif(scene, window.location.origin));
      }}><div className={styles.media}><ScenePreview scene={scene} /></div><strong>{scene.title}</strong><span>{scene.description}</span></button>)}</div>
      {keyword && <button type="button" className={styles.more} onClick={() => { trackEvent("scene_keyword_search_clicked", { keyword: keyword.keyword }); setSearch(keyword.query); }}>‘{keyword.keyword}’ 장면 더 찾아보기 →</button>}
      <form className={styles.search} role="search" onSubmit={event => { event.preventDefault(); setSearch(query.trim()); }}><label htmlFor="scene-direct-search">떠오르는 장면 직접 검색</label><div><input id="scene-direct-search" type="search" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} placeholder="예: 고양이, 축하, 달리기" /><button type="submit">검색</button></div></form>
      <button type="button" className={styles.more} onClick={() => setSearch("")}>Trending · 전체 카테고리 둘러보기 →</button>
      <p className={styles.credit}>GIFs via <a href="https://klipy.com" target="_blank" rel="noreferrer">KLIPY</a></p>
    </div></>}
  </dialog>;
}
