import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function CreditsPolicyPage() {
  return (
    <PolicyPage
      title="GIF 합성 이용권 정책"
      description="이용권의 사용기한, 사용 순서와 작업 실패 시 복구 기준을 안내합니다."
    >
      <section>
        <h2 className="text-base font-bold text-white">5회 이용권 사용</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>GIF 합성 5회 이용권의 가격은 6,600원이며, 결제일부터 7일간 사용할 수 있습니다.</li>
          <li>합성 작업을 요청하면 이용권 1회가 사용되고 AI 합성 작업이 바로 시작됩니다.</li>
          <li>이용권이 없거나 사용기한이 지난 경우 작업을 시작할 수 없습니다.</li>
          <li>사용기한이 지나면 해당 구매 건의 남은 횟수는 소멸합니다.</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">구매 건별 관리와 사용 순서</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>이용권을 여러 번 구매하면 각 구매 건의 남은 횟수와 만료일을 별도로 관리합니다.</li>
          <li>합성 요청 시 사용기한이 가장 먼저 끝나는 이용권부터 사용됩니다.</li>
          <li>가입·이벤트·운영상 보상으로 무상 지급된 이용권은 현금으로 환불되지 않습니다.</li>
          <li>사용하지 않은 유료 이용권의 환불 기준은 결제 및 환불정책을 따릅니다.</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">작업 실패 시 이용 횟수 복구</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>합성 작업이 시스템에서 실패 상태로 종료된 경우 해당 작업에 사용된 1회는 자동 복구됩니다.</li>
          <li>복구 시 원 이용권의 사용기한이 남아 있으면 그 이용권으로 되돌립니다.</li>
          <li>복구 시 원 이용권이 이미 만료됐다면 복구 시점부터 24시간 동안 사용할 수 있는 1회를 별도로 지급합니다.</li>
          <li>작업이 장시간 처리 중이거나 결과물을 확인할 수 없는 경우 support@gifgloo.com으로 가입한 계정 이메일과 작업 시간을 보내주세요.</li>
          <li>확인 결과 시스템 오류 등 회사 책임으로 작업이 정상 완료되지 않은 경우 이용 횟수 복구 또는 재작업을 지원합니다.</li>
          <li>결과물이 정상적으로 제공된 후 AI 생성 특성에 따른 단순한 취향 또는 기대 차이는 이용 횟수 복구 대상이 아닙니다.</li>
        </ul>
      </section>

      <p className="mt-8 text-xs text-white/35">시행일: 2026년 8월 21일</p>
    </PolicyPage>
  );
}
