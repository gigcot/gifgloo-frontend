"use client";

interface Props {
  onClose: () => void;
}

export function NewUserWelcomeModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1a1a] p-6 text-center">
        <div className="mb-3 text-5xl">🎉</div>
        <h2 className="mb-1 text-xl font-bold text-white">환영해요!</h2>
        <p className="mb-4 text-sm text-white/60">
          가입 기념으로 <span className="font-semibold text-purple-400">50 크레딧</span>을 드렸어요.
          <br />
          지금 바로 GIF 합성을 시작해보세요!
        </p>
        <button
          onClick={onClose}
          className="w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-700 active:scale-95"
        >
          시작하기
        </button>
      </div>
    </div>
  );
}
