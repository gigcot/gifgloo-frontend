import { Header } from "@/shared/ui/Header";
import { ComposePanel } from "@/features/compose/ui/ComposePanel";

export default function ComposePage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <Header title="합성하기" showBack />
      <ComposePanel />
    </div>
  );
}
