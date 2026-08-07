import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const revision = process.env.APP_REVISION;
  if (!revision) {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }

  return NextResponse.json(
    { status: "ok", revision },
    { headers: { "Cache-Control": "no-store" } },
  );
}
