import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";

export const dynamic = "force-dynamic";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

async function assertAdmin(configuredPath: string) {
  const cookieHeader = (await cookies()).toString();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${configuredPath}/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
  } catch {
    notFound();
  }

  if (!res.ok) notFound();
}

export default async function HiddenAdminPage({
  params,
}: {
  params: Promise<{ adminPath: string[] }>;
}) {
  const { adminPath } = await params;
  const configuredPath = normalizePath(process.env.ADMIN_PANEL_PATH ?? "");
  const requestedPath = `/${adminPath.join("/")}`;

  if (!configuredPath || requestedPath !== configuredPath) {
    notFound();
  }

  await assertAdmin(configuredPath);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header title="운영 대시보드" action={<HeaderActions />} />
      <main className="mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-8">
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-sm font-semibold text-purple-300">ops dashboard</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">운영 대시보드</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
            이 화면은 숨겨진 UUID 경로와 관리자 이메일 allowlist를 모두 통과한 계정만 접근할 수 있습니다.
            다음 단계에서 실패 작업, 결제, 크레딧 수동 지급 API를 여기에 붙이면 됩니다.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["오늘 합성 요청", "준비 중"],
            ["실패 작업", "준비 중"],
            ["결제 금액", "준비 중"],
            ["수동 조치", "준비 중"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-[#111113] p-5">
              <p className="text-xs font-semibold text-white/40">{label}</p>
              <p className="mt-3 text-2xl font-black text-white">{value}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
