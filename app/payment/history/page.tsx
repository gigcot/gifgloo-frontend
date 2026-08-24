import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import { CreditHistoryPage } from "@/features/credits/ui/CreditHistoryPage";
import { Header } from "@/shared/ui/Header";


export default function PaymentHistoryRoute() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <Header title="결제 및 이용 내역" showBack action={<HeaderActions />} />
      <CreditHistoryPage />
    </div>
  );
}
