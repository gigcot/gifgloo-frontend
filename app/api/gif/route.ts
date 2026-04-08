import { NextRequest, NextResponse } from "next/server";

const APP_KEY = process.env.KLIPY_API_KEY!;
const BASE = "https://api.klipy.com/api/v1";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type"); // "trending" | "search"
  const q = searchParams.get("q") ?? "";
  const page = searchParams.get("page") ?? "1";
  const perPage = searchParams.get("per_page") ?? "24";
  const customerId = searchParams.get("customer_id") ?? "anonymous";

  let url: string;
  if (type === "search" && q) {
    url = `${BASE}/${APP_KEY}/gifs/search?q=${encodeURIComponent(q)}&customer_id=${customerId}&page=${page}&per_page=${perPage}`;
  } else {
    url = `${BASE}/${APP_KEY}/gifs/trending?customer_id=${customerId}&page=${page}&per_page=${perPage}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Klipy API error" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
