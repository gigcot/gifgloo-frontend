import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function RefundPage() {
  return (
    <PolicyPage
      title="결제 및 환불정책"
      description="GIF 합성 이용권 구매, 사용, 취소 및 환불 기준을 안내합니다."
    >
      <section>
        <h2 className="text-base font-bold text-white">작업 시작 전 취소</h2>
        <p className="mt-3">
          GIF 합성 화면에서 시작하기를 누르기 전에는 작업을 취소할 수 있으며 이용권 횟수가 사용되지 않습니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">미사용 유료 이용권 환불</h2>
        <p className="mt-3">
          이용권 사용기한 내에는 해당 결제 건의 사용하지 않은 횟수에 대해 환불을 신청할 수 있습니다.
          이용권을 전혀 사용하지 않은 경우에는 해당 결제 건을 전액 환불하고, 일부를 사용한 경우에는 남은 횟수에 해당하는 금액을 계산하여 부분 환불합니다.
          이벤트, 가입 또는 운영상 보상으로 무상 지급된 이용권은 환불 금액에 포함되지 않습니다.
        </p>
        <p className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3 text-xs leading-5 text-white/50">
          부분 환불 기준 금액 = 결제 금액 × 환불 대상 잔여 횟수 ÷ 해당 결제 건의 총 제공 횟수
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">작업 시작 후 중도 취소</h2>
        <p className="mt-3">
          시작하기를 눌러 GIF 합성 작업이 시작되면 이용권 1회가 사용되고 디지털 콘텐츠 제작이 개시됩니다.
          작업 시작 후에는 중도 취소 기능을 제공하지 않으며, 단순 변심에 의한 사용 횟수 복구 및 환불이 제한됩니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">결과물 제공 후 환불 제한</h2>
        <p className="mt-3">
          결과물이 정상적으로 제공된 후 AI 생성 특성에 따른 단순한 취향 또는 기대 차이는 사용 횟수 복구 및 환불 대상이 아닙니다.
          다만 결과물이 열리지 않거나 제공되지 않은 경우, 또는 회사의 시스템 오류로 작업이 정상 완료되지 않은 경우에는 아래 판매자 귀책 기준에 따라 처리합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">작업 실패 및 판매자 귀책</h2>
        <p className="mt-3">
          합성 작업이 시스템에서 실패 상태로 종료된 경우 해당 작업에 사용된 1회는 자동 복구됩니다.
          원 이용권이 이미 만료된 뒤 복구되는 경우에는 복구 시점부터 24시간 동안 사용할 수 있는 1회가 지급됩니다.
          작업이 장시간 처리 중이거나 결과물을 확인할 수 없는 경우 고객지원 확인 후 이용 횟수 복구 또는 재작업을 지원합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">신청 및 처리</h2>
        <p className="mt-3">
          환불은 support@gifgloo.com으로 계정 이메일, 주문번호 및 환불 사유를 적어 신청할 수 있습니다.
          접수 후 결제 내역과 이용권 사용 여부를 확인하여 처리 결과를 안내하며, 승인된 환불은 원칙적으로 최초 결제수단으로 진행합니다.
        </p>
      </section>

      <p className="mt-8 text-xs text-white/35">시행일: 2026년 8월 21일</p>
    </PolicyPage>
  );
}
