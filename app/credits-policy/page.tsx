import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function CreditsPolicyPage() {
  return (
    <PolicyPage
      title="크레딧 정책"
      description="서비스별 크레딧 차감과 작업 실패 시 복구 기준을 안내합니다."
    >
      <section>
        <h2 className="text-base font-bold text-white">크레딧 사용</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>크레딧은 서비스별 AI 합성 작업에 사용됩니다.</li>
          <li>필요 크레딧, 제공 범위 및 예상 작업 시간은 작업 시작 전 해당 서비스 화면에 표시됩니다.</li>
          <li>현재 제공 중인 GIF 이미지 합성은 작업 요청 시 10크레딧이 차감됩니다.</li>
          <li>크레딧이 부족한 경우 작업을 시작할 수 없습니다.</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">유료 및 무상 크레딧</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>결제로 구매한 유료 크레딧과 이벤트, 가입 또는 운영상 보상으로 무상 지급된 크레딧은 구분하여 관리합니다.</li>
          <li>무상 지급 크레딧은 현금으로 환불되지 않습니다.</li>
          <li>사용하지 않은 유료 크레딧의 환불 기준은 결제 및 환불정책을 따릅니다.</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">작업 실패 시 크레딧 복구</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>합성 작업이 시스템에서 실패 상태로 종료된 경우 해당 작업에 사용된 10크레딧은 자동 복구됩니다.</li>
          <li>작업이 장시간 처리 중이거나 결과물을 확인할 수 없는 경우 support@gifgloo.com으로 가입한 계정 이메일과 작업 시간을 보내주세요.</li>
          <li>확인 결과 시스템 오류 등 회사 책임으로 작업이 정상 완료되지 않은 경우 크레딧 복구 또는 재작업을 지원합니다.</li>
          <li>결과물이 정상적으로 제공된 후 AI 생성 특성에 따른 단순한 취향 또는 기대 차이는 크레딧 복구 대상이 아닙니다.</li>
        </ul>
      </section>

      <p className="mt-8 text-xs text-white/35">시행일: 2026년 8월 9일</p>
    </PolicyPage>
  );
}
