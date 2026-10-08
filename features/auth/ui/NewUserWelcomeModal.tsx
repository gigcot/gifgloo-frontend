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
          이제 계정으로 결과와 이용 내역을 확인할 수 있어요.
          <br />
          무료 2회는 처음 이용할 때 한 번 지급돼요. 체험 후 가입했다면 남은 횟수가 그대로 이어져요.
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
