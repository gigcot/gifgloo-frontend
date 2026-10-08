import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import { ComposePanel } from "@/features/compose/ui/ComposePanel";

export default function ComposePage() {
  return (
    <div className="first-experience min-h-screen">
      <Header firstExperience showBack action={<HeaderActions compact />} />
      <ComposePanel />
    </div>
  );
}
