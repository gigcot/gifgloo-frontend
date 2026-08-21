import Link from "next/link";
import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function ServiceGuidePage() {
  return (
    <PolicyPage
      title="서비스 안내"
      description="gifgloo에서 제공하는 AI 기반 GIF 이미지 합성 서비스의 이용 조건을 안내합니다."
    >
      <section>
        <h2 className="text-base font-bold text-white">AI 기반 GIF 이미지 합성</h2>
        <p className="mt-3">
          업로드한 사진 1장과 선택한 GIF를 AI로 합성해 새로운 GIF 결과물을 제작하는 서비스입니다.
          현재 GIF 이미지 합성에는 OpenAI GPT Image 1.5 기반 기술을 사용합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">현재 제공 중인 서비스의 이용 기준</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>GIF 합성 5회 이용권은 6,600원이며 결제일부터 7일간 사용할 수 있습니다.</li>
          <li>GIF 이미지 합성 작업을 요청할 때마다 이용권 1회가 사용됩니다.</li>
          <li>GIF는 최대 20프레임으로 처리될 수 있습니다.</li>
          <li>결과물은 내 에셋에서 확인, 다운로드 및 공유할 수 있습니다.</li>
          <li>결과물 수정 기능은 현재 제공하지 않습니다.</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">작업 및 보관 기간</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>이용권 1회 사용 후 합성 작업이 시작됩니다.</li>
          <li>작업은 통상 2~3분 내에 완료됩니다.</li>
          <li>대기열, 외부 AI 서비스 상태 또는 기술적 사유에 따라 작업 시간이 달라질 수 있습니다.</li>
          <li>작업이 완료되면 결과물은 즉시 내 에셋에서 확인, 다운로드 및 공유할 수 있습니다.</li>
          <li>생성 결과물은 회원 탈퇴 또는 이용자의 삭제 요청 전까지 내 에셋에서 제공합니다.</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">모델 및 서비스 변경</h2>
        <p className="mt-3">
          서비스 품질 개선을 위해 AI 모델 또는 처리 방식이 변경될 수 있습니다. 이용 가격, 이용권 조건 또는 작업 기간에 영향을 주는 변경 사항은 해당 서비스 화면과 정책을 통해 안내합니다.
          AI 비디오 합성 등 신규 서비스는 별도의 이용 조건을 안내합니다.
        </p>
      </section>

      <p className="mt-8 text-xs text-white/35">
        결제 전 <Link href="/credits-policy" className="underline hover:text-white">이용권 정책</Link>과 <Link href="/refund" className="underline hover:text-white">결제 및 환불정책</Link>을 확인해주세요.
      </p>
    </PolicyPage>
  );
}
