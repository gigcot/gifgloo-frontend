import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function RefundPage() {
  return (
    <PolicyPage
      title="환불정책"
      description="크레딧 구매, 사용, 실패 작업에 대한 환불 기준을 안내하는 페이지입니다."
    >
      <p>
        결제 및 환불 정책은 결제 제공사 연동과 크레딧 차감 기준 확정 후 업데이트될 예정입니다.
      </p>
      <p className="mt-4">
        디지털 콘텐츠 특성상 이미 사용된 크레딧은 환불이 제한될 수 있으며, 실패 작업은 내부 기준에 따라 크레딧 복구 대상이 될 수 있습니다.
      </p>
    </PolicyPage>
  );
}
