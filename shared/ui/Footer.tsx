import Link from "next/link";

const policyLinks = [
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/refund", label: "환불정책" },
  { href: "/credits-policy", label: "크레딧 정책" },
  { href: "/contact", label: "문의" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#09090b] px-4 py-10 text-white">
      <div className="mx-auto grid max-w-screen-xl gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="text-xl font-black tracking-tight text-purple-400">gifgloo</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/50">
            GIF에 내 사진을 합성해 짧은 밈을 만드는 서비스입니다.
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
            <p>문의: support@gifgloo.com</p>
            <p>결제 및 환불 문의는 고객센터로 접수해주세요.</p>
            <p>사용된 크레딧은 디지털 콘텐츠 특성상 환불이 제한될 수 있습니다.</p>
          </div>
          <div className="mt-5 space-y-1 text-xs leading-5 text-white/35">
            <p>상호명: 부릉이상점</p>
            <p>대표자: 이재호</p>
            <p>사업자등록번호: 275-57-00990</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
