"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeftIcon, Cross2Icon, HamburgerMenuIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import type { Gif } from "@/entities/gif/model";
import { useContainedScroll } from "@/shared/ui/use-contained-scroll";
import { trackEvent } from "@/shared/lib/analytics";
import { findTopicMatches, loadGifTaxonomy, type GifBrowseCategory, type GifTopic } from "../model/taxonomy";
import { rememberGifBrowsePosition, saveGifBrowseSession, useGifBrowser } from "../model/use-gif-browser";
import { GifBrowserGrid } from "./GifBrowserGrid";
import { GifPreviewDialog } from "./GifPreviewDialog";
import styles from "./GifExplorer.module.css";

type Props = {
  selectedId: string | null;
  onSelect: (gif: Gif, source: string) => void;
  surface: "home" | "compose";
  onSourceChange?: (source: string) => void;
  onBoundary?: (delta: number) => void;
  footer?: React.ReactNode;
  selectionBar?: React.ReactNode;
  initialSearch?: string;
  intro?: React.ReactNode;
};

export function GifExplorer({ selectedId, onSelect, surface, onSourceChange, onBoundary, footer, selectionBar, initialSearch, intro }: Props) {
  const browser = useGifBrowser(surface);
  const { state } = browser;
  const [categories, setCategories] = useState<GifBrowseCategory[]>([]);
  const [taxonomyError, setTaxonomyError] = useState(false);
  const [taxonomyRetry, setTaxonomyRetry] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [categorySheet, setCategorySheet] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarId = useId();
  const [preview, setPreview] = useState<Gif | null>(null);
  const main = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useContainedScroll(main, { onBoundary });
  useContainedScroll(sidebar);
  const heading = useRef<HTMLHeadingElement>(null);
  const queryInput = useRef<HTMLInputElement>(null);
  const tips = useRef<HTMLDetailsElement>(null);
  const restored = useRef(false);
  const searchInitialized = useRef(false);
  useEffect(() => {
    if (!state.hydrated || searchInitialized.current || initialSearch === undefined) return;
    searchInitialized.current = true;
    browser.search(initialSearch, initialSearch || "지금 둘러볼 장면");
    queryInput.current?.focus({ preventScroll: true });
  }, [state.hydrated, initialSearch, browser]);
  const category = categories.find(item => item.id === state.categoryId);
  const source = state.categoryId ? "category" : state.query ? "search" : "trending";
  const matches = suggesting ? findTopicMatches(categories, state.input).slice(0, 6) : [];
  const topics = category?.topics ?? [];
  const shortcutCategory = category ?? categories.find(item => item.id === "actions");
  const shortcuts = category ? category.topics : shortcutCategory?.topics.filter(topic => ["dancing", "running", "laughing", "waiting", "sleeping", "fighting"].includes(topic.query)) ?? [];

  useEffect(() => {
    let cancelled = false;
    loadGifTaxonomy().then(data => { if (!cancelled) { setCategories(data); setTaxonomyError(false); } })
      .catch(() => { if (!cancelled) setTaxonomyError(true); });
    return () => { cancelled = true; };
  }, [taxonomyRetry]);

  useEffect(() => { onSourceChange?.(source); }, [source, onSourceChange]);

  useEffect(() => {
    if (!state.hydrated || state.loading || restored.current || (state.view === "topics" && !categories.length)) return;
    const host = main.current;
    const scrollTop = state.scrollTop;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (host) host.scrollTop = scrollTop;
        else window.scrollTo({ top: scrollTop, behavior: "instant" });
        restored.current = true;
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [state.hydrated, state.loading, state.view, state.scrollTop, categories.length]);

  useLayoutEffect(() => {
    const host = main.current;
    const target = host ?? window;
    let frame = 0;
    let lastPosition: number | undefined;
    function record() {
      if (!restored.current) return;
      lastPosition = host ? host.scrollTop : window.scrollY;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => rememberGifBrowsePosition(surface, lastPosition!, false));
    }
    const save = () => saveGifBrowseSession(surface);
    target.addEventListener("scroll", record, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", record);
      window.removeEventListener("pagehide", save);
      if (lastPosition !== undefined) rememberGifBrowsePosition(surface, lastPosition);
      else save();
    };
  }, [surface]);

  useEffect(() => {
    function closeTips(event: Event) {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Escape") return;
      if (tips.current && (event.type === "keydown" || !tips.current.contains(event.target as Node))) tips.current.open = false;
    }
    document.addEventListener("pointerdown", closeTips);
    document.addEventListener("keydown", closeTips);
    return () => { document.removeEventListener("pointerdown", closeTips); document.removeEventListener("keydown", closeTips); };
  }, []);

  useEffect(() => {
    if (!state.loading && state.items.length) trackEvent("gif_list_viewed", { source, surface, count: state.items.length });
  }, [state.loading, state.items.length, source, surface]);

  function moveToTop() {
    const host = main.current;
    if (host) host.scrollTo({ top: 0 });
    else window.scrollTo({ top: 0 });
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }
  function showCategory(item: GifBrowseCategory) {
    browser.showCategory(item.id, item.label); setCategorySheet(false); setSuggesting(false); moveToTop();
  }
  function showTrending() {
    browser.search("", "지금 둘러볼 장면"); setCategorySheet(false); setSuggesting(false); moveToTop();
  }
  function selectTopic(parent: GifBrowseCategory, topic: GifTopic) {
    browser.search(topic.query, topic.label, parent.id, topic.query);
    setSuggesting(false); queryInput.current?.blur(); moveToTop();
  }
  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const input = state.input.trim();
    if (!input) { showTrending(); return; }
    const exact = findTopicMatches(categories, input).find(({ topic }) => [topic.label, topic.english, topic.query].some(word => word.toLowerCase() === input.toLowerCase()));
    if (exact) selectTopic(exact.category, exact.topic);
    else { browser.search(input, input); setSuggesting(false); queryInput.current?.blur(); moveToTop(); }
  }
  function chooseGif(gif: Gif) {
    const host = main.current;
    rememberGifBrowsePosition(surface, host ? host.scrollTop : window.scrollY);
    if (surface === "home") {
      trackEvent("gif_selected", { source, surface });
      trackEvent("gif_selection_changed", { action: selectedId && selectedId !== gif.id ? "changed" : "selected", source, surface, control: "gif_tile" });
      onSelect(gif, source);
      return;
    }
    setPreview(gif);
    trackEvent("gif_preview_opened", { surface, source });
  }
  function confirmPreview() {
    if (!preview) return;
    const action = selectedId && selectedId !== preview.id ? "changed" : "selected";
    trackEvent("gif_selected", { source, surface });
    trackEvent("gif_selection_changed", { action, source, surface, control: "gif_preview" });
    setPreview(null);
    onSelect(preview, source);
  }
  const categoryButtons = <>
    <button type="button" aria-pressed={!state.categoryId} onClick={showTrending}>전체 장면</button>
    {categories.map(item => <button key={item.id} type="button" aria-pressed={state.categoryId === item.id} onClick={() => showCategory(item)}>{item.label}</button>)}
  </>;

  return <div className={styles.root} data-surface={surface} data-sidebar-collapsed={sidebarCollapsed}
    ref={surface === "compose" ? main : undefined}
    data-contained-scroll={surface === "compose" || undefined} data-gif-scroll-container={surface === "compose" || undefined}
    tabIndex={surface === "compose" ? 0 : undefined} role={surface === "compose" ? "region" : undefined} aria-label={surface === "compose" ? "장면 목록" : undefined}>
    {intro}
    <div className={styles.orientation}><p className={styles.orientationHint}>넣고 싶은 대상을 떠올리며 둘러보세요.</p>
      <div className={styles.orientationActions}><details ref={tips} className={styles.tips}><summary>고르는 팁</summary><div><p>표정이나 동작의 변화가 눈에 보이는 장면을 골라보세요.</p><p>넣을 대상이 그 움직임을 한다고 상상해보세요. 대상의 모습이 잘 보이는지도 함께 확인해보세요.</p></div></details></div>
    </div>
    <div className={styles.searchRow}>
      <button type="button" className={styles.sidebarToggle} aria-label={sidebarCollapsed ? "분류 펼치기" : "분류 접기"} aria-expanded={!sidebarCollapsed} aria-controls={sidebarId} onClick={() => setSidebarCollapsed(value => !value)}>{sidebarCollapsed && <HamburgerMenuIcon aria-hidden="true" />}분류{!sidebarCollapsed && <ChevronLeftIcon aria-hidden="true" />}</button>
      <button type="button" className={styles.mobileCategory} aria-label="카테고리 선택" aria-haspopup="dialog" aria-expanded={categorySheet} onClick={event => { event.currentTarget.focus({ preventScroll: true }); setCategorySheet(true); trackEvent("gif_categories_opened", { surface }); }}><HamburgerMenuIcon aria-hidden="true" />{category?.label ?? "분류"}</button>
      <form role="search" className={styles.search} onSubmit={submitSearch}
        onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSuggesting(false); }}>
        <MagnifyingGlassIcon aria-hidden="true" />
        <input ref={queryInput} type="search" aria-label="GIF 검색" placeholder="Search KLIPY · 장면, 감정, 작품" maxLength={120} autoComplete="off" value={state.input}
          onFocus={() => { setSuggesting(true); trackEvent("gif_search_focused", { surface }); }}
          onKeyDown={event => { if (event.key === "Escape") { setSuggesting(false); event.stopPropagation(); } }}
          onChange={event => { browser.setInput(event.target.value); setSuggesting(true); }} />
        {state.input && <button className={styles.clear} type="button" aria-label="검색어 지우기" onClick={() => { browser.setInput(""); setSuggesting(false); queryInput.current?.focus(); }}><Cross2Icon /></button>}
        <button type="submit" className={styles.searchSubmit}>검색</button>
        {matches.length > 0 && <div className={styles.suggestions} role="group" aria-label="연결할 수 있는 검색어">
          <p className={styles.searchHint}>영어 키워드로 검색하면 더 다양한 짤을 찾기 좋아요.</p>
          {matches.map(({ category: parent, topic }) => <button key={topic.query} type="button" onClick={() => selectTopic(parent, topic)}><span>{topic.label}</span><small>{topic.query}</small></button>)}
        </div>}
      </form>
    </div>
    <div className={styles.layout}>
      <aside id={sidebarId} ref={sidebar} hidden={sidebarCollapsed} className={styles.sidebar} data-contained-scroll data-gif-sidebar><nav aria-label="GIF 분류">{categoryButtons}</nav></aside>
      <div className={styles.resultsPane}>
      <div ref={surface === "home" ? main : undefined} className={styles.main}
        data-contained-scroll={surface === "home" || undefined} data-gif-scroll-container={surface === "home" || undefined}
        tabIndex={surface === "home" ? 0 : undefined} role={surface === "home" ? "region" : undefined} aria-label={surface === "home" ? "장면 목록" : undefined}>
        <div className={styles.location} hidden={state.view !== "results" || !category}>
          <div>{state.view === "results" && category && <button className={styles.backTopics} type="button" onClick={() => showCategory(category)}>{category.label} · 모든 주제 보기</button>}</div>

        </div>
        <h2 ref={heading} className="sr-only" tabIndex={-1}>{state.label}</h2>
        {taxonomyError && <p role="status" className={styles.notice}>분류를 불러오지 못했어요. <button onClick={() => setTaxonomyRetry(value => value + 1)}>다시 시도</button></p>}
        {state.view === "results" && shortcutCategory && <div className={styles.shortcuts} role="group" aria-label="다른 주제 둘러보기">{shortcuts.map(topic => <button type="button" key={topic.query} aria-pressed={state.topicQuery === topic.query} onClick={() => selectTopic(shortcutCategory, topic)}>{topic.label}</button>)}</div>}
        {state.view === "topics" ? <>
          <div className={styles.topicGrid}>{topics.map(topic => <button type="button" key={topic.query} className={styles.topicCard} aria-label={`${topic.label} GIF 둘러보기`} onClick={() => selectTopic(category!, topic)}>
            <div className={styles.topicCover}>{topic.preview_url && <img src={topic.preview_url} alt="" loading="lazy" onError={event => { event.currentTarget.style.visibility = "hidden"; }} />}</div>
            <span><strong>{topic.label}</strong><small>{topic.english}</small></span>
          </button>)}</div>
          {!topics.length && <p className={styles.notice} role="status">일치하는 주제가 없어요. 다른 단어로 찾아보세요.</p>}
        </> : <>
          <p className={state.loading || state.error ? styles.status : "sr-only"} role="status">{state.loading ? "장면을 불러오고 있어요…" : state.error && !state.items.length ? "GIF를 불러오지 못했어요." : `${state.items.length}개 장면${state.topicQuery ? ` · ${state.query}` : ""}`}</p>
          <GifBrowserGrid gifs={state.items} loading={state.loading} selectedId={selectedId} onChoose={chooseGif} actionLabel={surface === "home" ? "선택" : "미리보기"} />
          {state.error && <div className={styles.notice} role="status"><p>{state.items.length ? "더 불러오지 못했어요. 현재 목록은 유지돼요." : "잠시 후 다시 시도해 주세요."}</p><button type="button" onClick={browser.retry}>다시 불러오기</button></div>}
          {!state.loading && !state.error && !state.items.length && <p className={styles.notice}>검색 결과가 없어요. 다른 주제나 검색어로 둘러보세요.</p>}
          {!state.error && !state.loading && state.hasMore && state.items.length > 0 && <button type="button" className={styles.loadMore} disabled={state.loadingMore} onClick={browser.loadMore}>{state.loadingMore ? "불러오는 중…" : "더 둘러보기"}</button>}
        </>}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
      {selectionBar}
      </div>
    </div>
    {categorySheet && <CategorySheet onClose={() => setCategorySheet(false)}>{categoryButtons}</CategorySheet>}
    {preview && <GifPreviewDialog gif={preview} onClose={() => setPreview(null)} onConfirm={confirmPreview} />}
  </div>;
}

function CategorySheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropDown = useRef(false);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const ownsScrollLock = !dialog.parentElement?.closest("dialog[open]");
    if (ownsScrollLock) document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); if (ownsScrollLock) document.body.style.overflow = overflow; trigger?.focus({ preventScroll: true }); };
  }, []);
  function outside(event: { clientX: number; clientY: number }) {
    const bounds = ref.current!.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }
  return <dialog ref={ref} aria-labelledby="browse-category-title" className={styles.categorySheet}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onPointerDown={event => { backdropDown.current = event.target === event.currentTarget && outside(event); }}
    onClick={event => { if (backdropDown.current && event.target === event.currentTarget && outside(event)) onClose(); backdropDown.current = false; }}>
    <div className={styles.dialogTop}><h2 id="browse-category-title">GIF 분류</h2><button type="button" autoFocus aria-label="카테고리 닫기" onClick={onClose}><Cross2Icon /></button></div>
    <nav aria-label="모든 GIF 분류" className={styles.categoryOptions}>{children}</nav>
  </dialog>;
}
