import { PolicyPage } from "@/shared/ui/PolicyPage";

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="개인정보처리방침"
      description="계정, 업로드 이미지, 결제 처리 과정에서 필요한 개인정보 처리 기준을 안내하는 페이지입니다."
    >
      <p>
        정식 개인정보처리방침은 인증, 결제, 파일 보관 정책 확정 후 업데이트될 예정입니다.
      </p>
      <p className="mt-4">
        서비스 제공을 위해 계정 식별 정보, 업로드 파일, 생성 결과, 결제 상태 정보가 처리될 수 있습니다.
      </p>
    </PolicyPage>
  );
}
