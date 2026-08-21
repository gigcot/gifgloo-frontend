import Link from "next/link";

const policyLinks = [
  { href: "/service-guide", label: "서비스 안내" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund", label: "결제 및 환불정책" },
  { href: "/credits-policy", label: "이용권 정책" },
  { href: "/contact", label: "문의" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#09090b] px-4 py-10 text-white">
      <div className="mx-auto grid max-w-screen-xl gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="text-xl font-black tracking-tight text-purple-400">gifgloo</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/50">
            업로드한 사진과 GIF를 AI로 합성해 새로운 GIF 결과물을 만드는 서비스입니다.
          </p>
          <p className="mt-4 text-xs text-white/35">Copyright © 2026 gifgloo. All rights reserved.</p>
        </div>

        <div>
          <p className="text-sm font-bold text-white/80">정책</p>
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-2 md:flex-col">
            {policyLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-white/45 transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="text-sm font-bold text-white/80">고객지원</p>
          <div className="mt-3 space-y-2 text-sm text-white/45">
            <p>이메일: support@gifgloo.com</p>
            <p>전화: 010-9109-3066</p>
            <p>서비스 관련 문의 및 건의사항을 보내주세요.</p>
          </div>
          <div className="mt-5 space-y-1 text-xs leading-5 text-white/35">
            <p>상호명: 부릉이상점</p>
            <p>대표자: 이재호</p>
            <p>사업자등록번호: 275-57-00990</p>
            <p>사업장 주소: 서울특별시 서초구 반포동 735-3</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
