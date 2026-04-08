"use client";

const TRENDING_CATEGORIES = ["Love", "Happy", "Hello", "Excited", "Funny", "Hug", "Party", "Sad"];

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="sticky top-[53px] z-40 bg-[#0d0d0d]/90 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto max-w-screen-xl">
        <div className="relative">
          <input
            type="text"
            placeholder="Search KLIPY"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-full bg-white/10 px-5 py-3 text-base text-white placeholder-white/40 outline-none transition-colors focus:bg-white/15"
          />
          <svg
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {TRENDING_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onChange(cat)}
              className="shrink-0 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-purple-600/50 hover:text-white"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
