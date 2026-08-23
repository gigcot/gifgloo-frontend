import { notFound } from "next/navigation";
import { Header } from "@/shared/ui/Header";
import { HeaderActions } from "@/features/auth/ui/HeaderActions";
import { AdminDashboardClient } from "./AdminDashboardClient";

export const dynamic = "force-dynamic";

function normalizePath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
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

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Header title="운영 대시보드" action={<HeaderActions />} />
      <AdminDashboardClient adminPath={configuredPath} />
    </div>
  );
}
