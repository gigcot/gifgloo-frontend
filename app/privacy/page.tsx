import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="개인정보처리방침"
      description="계정, 업로드 이미지, 결제 처리 과정에서 필요한 개인정보 처리 기준을 안내하는 페이지입니다."
    >
      <section>
        <h2 className="text-base font-bold text-white">1. 개인정보 처리 목적</h2>
        <p className="mt-3">
          회사는 회원 식별 및 로그인, AI 기반 GIF 이미지 합성, 결과물 제공·보관, 결제·환불 처리, 부정 이용 방지 및 고객지원 목적으로 개인정보를 처리합니다.
          수집한 개인정보는 안내한 목적 외의 용도로 이용하지 않으며, 목적이 변경되는 경우 관계 법령에 따른 절차를 거칩니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">2. 처리하는 개인정보 항목</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>소셜 로그인 정보: 로그인 제공자, 제공자별 식별자, 이메일(제공되는 경우)</li>
          <li>서비스 이용 정보: GIF 검색어와 검색 식별자, 업로드 사진, 선택한 GIF 정보, 생성 결과물, 작업 기록, 크레딧 이용 기록</li>
          <li>결제 정보: 주문번호, 결제 금액, 결제 상태, 결제 제공사 거래 식별자</li>
          <li>문의 정보: 문의 시 이용자가 제공한 이메일, 주문번호 및 문의 내용</li>
          <li>자동 생성 정보: 접속 일시, IP 주소, 브라우저·기기 정보, 쿠키 및 서비스 이용 기록</li>
        </ul>
        <p className="mt-3">회사는 카드번호, 계좌번호 등 결제수단의 원본 정보를 직접 저장하지 않습니다.</p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">3. 처리 근거 및 보유 기간</h2>
        <p className="mt-3">
          계정 생성, 이미지 합성, 결과물 제공 및 결제 처리를 위해 필요한 개인정보는 서비스 이용계약의 체결·이행을 근거로 처리하며, 원칙적으로 회원 탈퇴 또는 삭제 요청 시까지 보관합니다.
          업로드 사진과 생성 결과물은 회원 탈퇴 또는 개별 삭제 요청 시까지 보관합니다.
        </p>
        <p className="mt-4">다만 관계 법령에 따라 다음 기록은 해당 기간 동안 별도로 보관합니다.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
          <li>대금결제 및 재화·서비스 공급에 관한 기록: 5년</li>
          <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
          <li>표시·광고에 관한 기록: 6개월</li>
        </ul>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">4. 개인정보 파기 절차 및 방법</h2>
        <p className="mt-3">
          보유 기간이 끝나거나 처리 목적이 달성되어 개인정보가 불필요해지면 지체 없이 파기합니다.
          관계 법령에 따라 보관해야 하는 정보는 일반 이용 정보와 분리하여 보관하고 법정 기간이 끝난 뒤 파기합니다.
          전자적 파일은 복구하거나 재생할 수 없는 방법으로 삭제하고, 출력물이 있는 경우에는 분쇄하거나 소각합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">5. 소셜 로그인 및 외부 서비스</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>Google 및 Kakao: 소셜 로그인 인증 및 회원 식별 정보 제공</li>
          <li>Klipy: GIF 검색, GIF 콘텐츠 및 검색 결과 제공</li>
          <li>Toss Pay: 주문 확인, 결제 및 환불 처리</li>
          <li>Cloudflare R2(APAC 위치 힌트): 업로드 파일 및 생성 결과물 저장</li>
          <li>Amazon Web Services 서울 리전: GIF 처리 작업 실행</li>
          <li>OpenAI: AI 이미지 분석 및 GIF 이미지 합성</li>
        </ul>
        <p className="mt-3">
          AI 합성에 필요한 업로드 사진과 GIF 프레임은 결과물 생성을 위해 외부 AI 처리 과정에서 처리될 수 있습니다.
          OpenAI API로 전송된 정보는 OpenAI의 기본 남용 모니터링 정책에 따라 최대 30일간 보관될 수 있습니다.
          회사는 외부 서비스 이용 현황이 변경되면 본 방침에 반영합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">6. 쿠키 및 브라우저 저장소</h2>
        <p className="mt-3">회사는 로그인 상태 유지와 화면 간 선택 항목 복원을 위해 쿠키와 브라우저 저장소를 사용합니다.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>로그인 인증 쿠키: 로그인 상태 확인에 사용하며 로그아웃 또는 쿠키 만료 시까지 보관됩니다.</li>
          <li>Klipy 검색 식별자: GIF 검색 기능 제공에 사용하며 브라우저 데이터가 삭제될 때까지 보관됩니다.</li>
          <li>선택한 GIF와 업로드 사진의 임시 데이터: 로그인 또는 화면 이동 뒤 선택 항목 복원에 사용하며 합성 화면에서 복원될 때까지 보관됩니다.</li>
        </ul>
        <p className="mt-3">
          이용자는 브라우저 설정에서 쿠키와 저장 데이터를 삭제하거나 저장을 제한할 수 있습니다. 다만 이 경우 로그인 유지 또는 선택 항목 복원 기능이 정상적으로 동작하지 않을 수 있습니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">7. 이용자의 권리 및 행사 방법</h2>
        <p className="mt-3">
          이용자는 자신의 개인정보에 대해 열람, 정정, 삭제 또는 처리정지를 요청할 수 있습니다.
          회원 탈퇴, 결과물 삭제와 개인정보 관련 요청은 support@gifgloo.com으로 접수할 수 있으며, 본인 확인을 위해 가입한 계정 이메일 또는 필요한 최소한의 정보를 요청할 수 있습니다.
          회사는 관계 법령에서 정한 사유가 없는 한 요청을 확인한 뒤 지체 없이 처리합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">8. 개인정보의 안전성 확보조치</h2>
        <p className="mt-3">
          회사는 개인정보 접근 권한 관리, 전송 구간 암호화, 접속 기록 관리 및 저장 데이터 보호 등 개인정보의 안전성 확보에 필요한 기술적·관리적 조치를 적용합니다.
        </p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">9. 개인정보 보호책임자</h2>
        <p className="mt-3">개인정보 보호책임자: 이재호 · 이메일: support@gifgloo.com · 전화: 010-9109-3066</p>
        <p className="mt-3">개인정보 처리에 관한 문의, 불만 처리 및 권리 행사는 위 이메일로 접수할 수 있습니다.</p>
      </section>

      <section className="mt-8 border-t border-white/10 pt-8">
        <h2 className="text-base font-bold text-white">10. 개인정보처리방침의 변경</h2>
        <p className="mt-3">
          법령, 서비스 또는 개인정보 처리 내용이 변경되는 경우 본 방침을 수정할 수 있으며, 중요한 변경 사항은 시행 전에 서비스 화면을 통해 안내합니다.
        </p>
      </section>

      <p className="mt-8 text-xs text-white/35">시행일: 2026년 8월 9일</p>
    </PolicyPage>
  );
}
