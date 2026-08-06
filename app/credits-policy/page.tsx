import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function CreditsPolicyPage() {
  return (
    <PolicyPage
      title="크레딧 정책"
      description="합성 작업에 필요한 크레딧 차감과 복구 기준을 안내하는 페이지입니다."
    >
      <p>
        크레딧은 GIF 합성 작업을 시작할 때 사용되며, 정확한 차감 기준은 결제 상품 구성 후 업데이트될 예정입니다.
      </p>
      <p className="mt-4">
        작업 실패, 중복 차감, 환불 처리 등 운영 이슈는 고객지원 확인 후 조정될 수 있습니다.
      </p>
    </PolicyPage>
  );
}
