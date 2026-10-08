"use client";
import { MagnifyingGlassIcon, Cross2Icon } from "@radix-ui/react-icons";
import { trackEvent } from "@/shared/lib/umami";
export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div data-journey-section="search" className="search">
    <MagnifyingGlassIcon aria-hidden="true" /><input aria-label="GIF 검색" placeholder="GIF 검색" type="search" value={value}
      onFocus={() => trackEvent("gif_search_focused")} onChange={event => onChange(event.target.value)} />
    {value && <button aria-label="검색어 지우기" onClick={() => onChange("")}><Cross2Icon /></button>}
  </div>;
}
