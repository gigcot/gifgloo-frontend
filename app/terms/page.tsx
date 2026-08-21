import Link from "next/link";

import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function TermsPage() {
  return (
    <PolicyPage
      title="이용약관"
      description="gifgloo 서비스 이용 조건과 책임 범위를 안내하는 페이지입니다."
    >
      <section>
        <h2 className="text-base font-bold text-white">제1조 목적</h2>
        <p className="mt-3">
          본 약관은 부릉이상점(이하 “회사”)이 제공하는 gifgloo AI 기반 GIF 이미지 합성 서비스의 이용 조건과 회사 및 이용자의 권리·의무를 정합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제2조 용어의 정의</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>“회원”이란 Google 또는 Kakao 계정으로 로그인하여 서비스를 이용하는 사람을 말합니다.</li>
          <li>“이용권”이란 정해진 사용기한과 횟수 안에서 GIF 합성 작업을 요청할 수 있는 상품을 말합니다.</li>
          <li>“결과물”이란 회원이 선택한 GIF와 업로드한 사진을 바탕으로 서비스가 생성한 GIF 파일을 말합니다.</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제3조 이용계약과 계정 관리</h2>
        <p className="mt-3">
          이용계약은 이용자가 소셜 로그인을 통해 가입을 요청하고 회사가 계정을 생성하면 성립합니다.
          회원은 자신의 계정을 직접 관리해야 하며, 계정을 타인에게 양도·대여하거나 결제수단을 부정하게 사용해서는 안 됩니다.
          계정의 도용 또는 무단 사용을 확인한 경우 즉시 support@gifgloo.com으로 알려야 합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제4조 서비스 내용과 제공 조건</h2>
        <p className="mt-3">
          회사는 회원이 선택한 GIF와 업로드한 사진을 AI로 처리하여 GIF 결과물을 제공합니다.
          판매가격, 이용 횟수와 사용기한, 제공 범위, 작업 방식, 예상 작업 시간, 결과물 제공 방식 및 수정 가능 횟수는
          <Link href="/service-guide" className="mx-1 text-purple-300 underline underline-offset-2">서비스 안내</Link>
          와 작업 시작 전 화면에서 확인할 수 있습니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제5조 이용권, 결제 및 환불</h2>
        <p className="mt-3">
          이용권은 GIF 합성 작업에 사용되며 현금처럼 다른 회원에게 양도할 수 없습니다.
          결제 금액, 제공 횟수와 사용기한은 결제 전에 표시하고, 작업별 사용 횟수는 작업 시작 전에 표시합니다.
          구매·차감·취소·환불에 관한 세부 사항은
          <Link href="/refund" className="mx-1 text-purple-300 underline underline-offset-2">결제 및 환불정책</Link>
          과
          <Link href="/credits-policy" className="mx-1 text-purple-300 underline underline-offset-2">이용권 정책</Link>
          을 따릅니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제6조 업로드 콘텐츠와 이용 허락</h2>
        <p className="mt-3">
          회원은 업로드하는 사진과 GIF를 사용할 적법한 권리를 보유해야 합니다.
          회원은 결과물 생성·저장·전송 등 서비스 제공에 필요한 범위에서만 회사가 업로드 콘텐츠를 복제, 변환 및 처리하는 것을 허락합니다.
          이 허락은 서비스 제공 목적에 한정되며, 회원이 보유한 콘텐츠의 권리가 회사로 이전되는 것은 아닙니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제7조 금지 행위</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>타인의 초상권, 저작권, 개인정보 또는 기타 권리를 침해하는 콘텐츠를 업로드·생성·배포하는 행위</li>
          <li>불법적이거나 음란·폭력적 콘텐츠, 아동·청소년을 성적으로 묘사하는 콘텐츠를 처리하는 행위</li>
          <li>서비스의 정상 운영을 방해하거나 취약점을 악용하고, 이용권 또는 결제 절차를 부정하게 이용하는 행위</li>
          <li>다른 사람을 사칭하거나 결과물을 기만·사기 등 위법한 목적으로 사용하는 행위</li>
        </ul>
        <p className="mt-3">회사는 위반 행위가 확인되면 관련 법령이 허용하는 범위에서 작업을 제한하거나 계정 이용을 정지할 수 있습니다.</p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제8조 AI 결과물과 권리</h2>
        <p className="mt-3">
          AI 결과물은 입력 이미지, GIF 및 AI 모델의 특성에 따라 회원의 기대와 다를 수 있으며 동일한 입력에서도 다른 결과가 생성될 수 있습니다.
          회원은 결과물을 이용하기 전에 제3자의 초상권, 저작권, 상표권 등 권리 침해 여부와 이용 목적에 적용되는 법령을 직접 확인해야 합니다.
          회사는 제3자의 권리까지 회원에게 이전하거나 결과물의 독점성 또는 특정 목적 적합성을 보증하지 않습니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제9조 서비스 변경 및 중단</h2>
        <p className="mt-3">
          회사는 품질 개선을 위해 AI 모델 또는 처리 방식을 변경할 수 있습니다.
          점검, 장애, 외부 서비스 중단 또는 불가피한 운영상 사유가 있는 경우 서비스의 전부 또는 일부가 일시 중단될 수 있습니다.
          이용 가격, 이용권 조건 또는 주요 제공 조건이 변경되는 경우 적용 전에 서비스 화면을 통해 안내합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제10조 회원 탈퇴 및 이용 제한</h2>
        <p className="mt-3">
          회원은 support@gifgloo.com으로 탈퇴를 요청할 수 있습니다.
          탈퇴 시 개인정보는
          <Link href="/privacy" className="mx-1 text-purple-300 underline underline-offset-2">개인정보처리방침</Link>
          에 따라 처리하며, 결제·거래 기록 등 관계 법령에 따라 보관해야 하는 정보는 법정 기간 동안 분리 보관합니다.
          회사가 이용을 제한하는 경우에는 그 사유와 이의신청 방법을 안내합니다. 다만 긴급한 보안 위험이나 법령상 제한 사유가 있는 경우에는 사후 안내할 수 있습니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제11조 회사와 회원의 책임</h2>
        <p className="mt-3">
          회사는 관련 법령과 본 약관을 준수하고 서비스를 안정적으로 제공하기 위해 노력합니다.
          회사의 고의 또는 과실로 회원에게 손해가 발생한 경우 관계 법령에 따라 책임을 부담합니다.
          회원의 귀책사유, 회원이 제공한 콘텐츠, 무료로 제공되는 서비스 또는 회사가 통제하기 어려운 외부 서비스 장애로 발생한 손해에 대한 책임은 관계 법령이 허용하는 범위에서 제한될 수 있습니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">제12조 문의, 약관 변경 및 분쟁 해결</h2>
        <p className="mt-3">
          서비스 이용, 결제 및 환불 문의는 support@gifgloo.com으로 접수할 수 있습니다.
          회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 회원에게 불리하거나 중요한 변경은 시행일과 변경 사유를 적용 전에 서비스 화면을 통해 안내합니다.
          본 약관과 서비스 이용에는 대한민국 법령이 적용되며, 분쟁이 발생하면 당사자 간 협의를 우선하고 해결되지 않는 경우 민사소송법상 관할 법원에서 해결합니다.
        </p>
      </section>

      <p className="mt-8 text-xs text-white/35">시행일: 2026년 8월 21일</p>
    </PolicyPage>
  );
}
