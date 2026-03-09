"use client";

type HeaderProps = {
  title?: string;
  showBack?: boolean;
  action?: React.ReactNode;
};

export function Header({ title, showBack, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d0d0d]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-3">
        {showBack && (
          <button
            onClick={() => window.history.back()}
            className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {title ? (
          <h1 className="text-lg font-bold text-white">{title}</h1>
        ) : (
          <h1 className="text-2xl font-black tracking-tight text-purple-400">gifgloo</h1>
        )}

        {action && <div className="ml-auto">{action}</div>}
      </div>
    </header>
  );
}
