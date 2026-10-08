"use client";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, Cross2Icon } from "@radix-ui/react-icons";
import { fetchGifCategories, type GifCategory } from "@/shared/api/klipy";
import { trackEvent } from "@/shared/lib/umami";

export function CategoryPicker({ selected, onSelect }: { selected: GifCategory | null; onSelect: (item: GifCategory) => void }) {
  const [open, setOpen] = useState(false);
  const [gifCategories, setCategories] = useState<GifCategory[]>([]);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetchGifCategories(controller.signal).then(items => {
      if (!controller.signal.aborted) { setCategories(items); setError(false); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open, reload]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropDown = useRef(false);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();

    function positionPanel() {
      const anchor = triggerRef.current!.getBoundingClientRect();
      const below = window.innerHeight - anchor.bottom - 24;
      const above = anchor.top - 24;
      const upward = below < 240 && above > below;
      const height = Math.min(480, Math.max(160, upward ? above : below));
      const top = upward ? anchor.top - height - 8 : anchor.bottom + 8;
      dialog.style.setProperty("--category-top", `${Math.max(16, top)}px`);
      dialog.style.setProperty("--category-height", `${height}px`);
      dialog.style.setProperty("--category-left", `${Math.max(16, Math.min(anchor.left, window.innerWidth - 496))}px`);
    }

    positionPanel();
    const current = dialog.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (current) {
      current.focus({ preventScroll: true });
      current.scrollIntoView({ block: "nearest" });
    } else {
      dialog.querySelector<HTMLElement>('.category-options')!.scrollTop = 0;
    }
    window.addEventListener("resize", positionPanel);
    return () => {
      window.removeEventListener("resize", positionPanel);
      document.body.style.overflow = previousOverflow;
      dialog.close();
    };
  }, [open]);

  function close() {
    dialogRef.current?.close();
  }

  function isOutside(event: { clientX: number; clientY: number }) {
    const bounds = dialogRef.current!.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }

  return <div className="category-picker">
    <button ref={triggerRef} className="category-trigger" data-active={Boolean(selected)}
      aria-label={selected ? `카테고리 선택: ${selected.label}` : "카테고리 선택"}
      aria-haspopup="dialog" aria-expanded={open} aria-controls="category-dialog" onClick={() => { setOpen(true); trackEvent("gif_categories_opened"); }}>
      {selected ? selected.label : "카테고리"}<ChevronDownIcon aria-hidden="true" />
    </button>
    <dialog ref={dialogRef} id="category-dialog" className="category-dialog" aria-labelledby="category-heading"
      onClose={() => { setOpen(false); triggerRef.current?.focus({ preventScroll: true }); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const buttons = event.currentTarget.querySelectorAll("button");
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onPointerDown={event => { backdropDown.current = event.target === event.currentTarget && isOutside(event); }}
      onClick={event => { if (backdropDown.current && event.target === event.currentTarget && isOutside(event)) close(); backdropDown.current = false; }}>
      <div className="category-panel-heading"><h2 id="category-heading">카테고리</h2><span>{gifCategories.length}</span>
        <button className="category-close" aria-label="카테고리 닫기" onClick={close} autoFocus><Cross2Icon /></button>
      </div>
      <div className="category-options" role="group" aria-label="전체 카테고리">
        {error && <p role="status">카테고리를 불러오지 못했어요. <button onClick={() => setReload(value => value + 1)}>다시 시도</button></p>}
        {!error && gifCategories.length === 0 && <p role="status">카테고리 불러오는 중…</p>}
        {gifCategories.map(item => <button key={item.query} aria-pressed={selected?.query === item.query}
          onClick={() => { onSelect(item); trackEvent("gif_category_selected", { category: item.query }); close(); }}><span>{item.label}</span>{selected?.query === item.query && <CheckIcon aria-hidden="true" />}</button>)}
      </div>
    </dialog>
  </div>;
}
