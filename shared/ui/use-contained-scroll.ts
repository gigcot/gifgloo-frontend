"use client";

import { useEffect, type RefObject } from "react";

export function useContainedScroll(
  ref: RefObject<HTMLElement | null>,
  { gain = .58, onBoundary }: { gain?: number; onBoundary?: (delta: number) => void } = {},
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    function owns(event: Event) {
      return !document.querySelector("dialog[open]") && event.target instanceof Element &&
        event.target.closest("[data-contained-scroll]") === element;
    }
    function atBoundary(delta: number) {
      return delta < 0 ? element!.scrollTop <= 1 : element!.scrollTop + element!.clientHeight >= element!.scrollHeight - 1;
    }
    function wheel(event: WheelEvent) {
      if (!owns(event) || event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element!.clientHeight : 1;
      const delta = event.deltaY * unit;
      if (atBoundary(delta)) onBoundary?.(Math.sign(delta) * Math.min(Math.abs(delta), 120));
      else { onBoundary?.(0); element!.scrollTop += delta * gain; }
    }
    let touch: { x: number; y: number } | null = null;
    function start(event: TouchEvent) {
      touch = owns(event) && event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }
    function move(event: TouchEvent) {
      if (!touch || !owns(event) || event.touches.length !== 1) return;
      const next = event.touches[0];
      const delta = touch.y - next.clientY;
      const horizontal = Math.abs(touch.x - next.clientX) > Math.abs(delta);
      touch = { x: next.clientX, y: next.clientY };
      if (horizontal) return;
      if (atBoundary(delta)) { event.preventDefault(); onBoundary?.(delta * 2); }
      else onBoundary?.(0);
    }
    function end() { touch = null; }
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("touchstart", start, { passive: true });
    element.addEventListener("touchmove", move, { passive: false });
    element.addEventListener("touchend", end);
    element.addEventListener("touchcancel", end);
    return () => {
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("touchstart", start);
      element.removeEventListener("touchmove", move);
      element.removeEventListener("touchend", end);
      element.removeEventListener("touchcancel", end);
    };
  }, [ref, gain, onBoundary]);
}
