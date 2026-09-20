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
    <footer className="border-t border-white/10 bg-[#09090b] px-4 py-6 text-white">
      <div className="mx-auto max-w-screen-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-baseline gap-3">
            <p className="text-lg font-black tracking-tight text-purple-400">gifgloo</p>
            <p className="text-xs text-white/30">© 2026 gifgloo</p>
          </div>

          <nav aria-label="정책" className="flex flex-wrap gap-x-4 gap-y-2">
            {policyLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-xs text-white/45 transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <details className="group mt-5 border-t border-white/10 pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-white/35 transition-colors hover:text-white/70 [&::-webkit-details-marker]:hidden">
            사업자 정보 및 고객지원
            <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-4 grid gap-4 text-xs leading-5 text-white/40 sm:grid-cols-2">
            <div>
              <p>이메일: support@gifgloo.com</p>
              <p>전화: 010-9109-3066</p>
            </div>
            <div>
              <p>상호명: 부릉이상점 · 대표자: 이재호</p>
              <p>사업자등록번호: 275-57-00990</p>
              <p>사업장 주소: 서울특별시 서초구 반포동 735-3</p>
            </div>
          </div>
        </details>
      </div>
    </footer>
  );
}
