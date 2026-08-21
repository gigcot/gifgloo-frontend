import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function ContactPage() {
  return (
    <PolicyPage
      title="문의"
    >
      <p>서비스 이용에 관한 문의 및 건의사항은 support@gifgloo.com 또는 010-9109-3066으로 접수해주세요.</p>
      <p className="mt-4">
        환불, 작업 실패, 이용권 관련 문의는 가입한 계정 이메일과 발생한 상황을 함께 적어주시면 더 빠르게 확인할 수 있습니다.
      </p>
      <p className="mt-4">
        환불 문의는 주문번호와 환불 사유도 함께 보내주세요. 결제 내역과 이용권 사용 여부를 확인한 뒤 처리 결과를 안내합니다.
      </p>
    </PolicyPage>
  );
}
