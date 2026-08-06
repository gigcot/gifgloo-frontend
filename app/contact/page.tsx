import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function ContactPage() {
  return (
    <PolicyPage
      title="문의"
      description="서비스 이용, 결제, 환불, 크레딧 문제를 접수하는 페이지입니다."
    >
      <p>문의 이메일: support@gifgloo.com</p>
      <p className="mt-4">
        결제 오류, 크레딧 미지급, 생성 실패 문의는 계정 이메일과 작업 시간을 함께 보내주시면 확인이 빨라집니다.
      </p>
    </PolicyPage>
  );
}
