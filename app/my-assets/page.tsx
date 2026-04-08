import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import { MyAssetsPage } from "@/features/compositions/ui/MyAssetsPage";

export default function MyAssetsRoute() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <Header title="내 에셋" showBack action={<HeaderActions />} />
      <MyAssetsPage />
    </div>
  );
}
