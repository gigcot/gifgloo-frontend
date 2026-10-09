import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import { ComposePanel } from "@/features/compose/ui/ComposePanel";
import { Suspense } from "react";

export default function ComposePage() {
  return (
    <div className="first-experience min-h-screen">
      <Header firstExperience showBack action={<HeaderActions compact />} />
      <Suspense fallback={<p role="status" className="p-8 text-center">작업을 확인하고 있어요.</p>}><ComposePanel /></Suspense>
    </div>
  );
}
