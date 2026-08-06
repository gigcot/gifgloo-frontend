import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function TermsPage() {
  return (
    <PolicyPage
      title="이용약관"
      description="gifgloo 서비스 이용 조건과 책임 범위를 안내하는 페이지입니다."
    >
      <p>
        정식 이용약관은 사업자등록, 결제 제공 방식, 환불 기준 확정 후 업데이트될 예정입니다.
      </p>
      <p className="mt-4">
        사용자는 타인의 권리를 침해하는 이미지나 GIF를 업로드하거나 생성 결과를 배포해서는 안 됩니다.
      </p>
    </PolicyPage>
  );
}
