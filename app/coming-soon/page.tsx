import { Header } from "@/shared/ui/Header";

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <Header showBack />
      <main className="flex flex-col items-center justify-center px-4 py-32 text-center">
        <p className="text-5xl">🚧</p>
        <p className="mt-6 text-xl font-bold text-white">준비 중이에요</p>
        <p className="mt-2 text-sm text-white/40">곧 만나볼 수 있어요. 조금만 기다려주세요!</p>
      </main>
    </div>
  );
}
