import type { Gif } from "@/entities/gif/model";

const APP_KEY = process.env.NEXT_PUBLIC_KLIPY_API_KEY!;
const BASE = "https://api.klipy.com/api/v1";

function generateUUID(): string {
  // crypto.randomUUID()는 HTTPS(secure context)에서만 동작.
  // 프로덕션은 항상 HTTPS이므로 폴백은 로컬 HTTP 개발 환경에서만 실제로 사용됨.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getCustomerId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("klipy_cid");
  if (!id) {
    id = generateUUID();
    localStorage.setItem("klipy_cid", id);
  }
  return id;
}

type KlipyFormat = { url: string; width: number; height: number; size: number };
type KlipySizes = { gif?: KlipyFormat; webp?: KlipyFormat; mp4?: KlipyFormat };

type KlipyItem = {
  id: number;
  slug: string;
  title: string;
  file: {
    hd: KlipySizes;
    md: KlipySizes;
    sm: KlipySizes;
    xs: KlipySizes;
  };
  blur_preview: string;
};

type KlipyResponse = {
  result: boolean;
  data: {
    data: KlipyItem[];
    current_page: number;
    per_page: number;
    has_next: boolean;
  };
};

function mapItem(item: KlipyItem): Gif {
  return {
    id: item.slug,
    slug: item.slug,
    title: item.title,
    file: item.file,
    blur_preview: item.blur_preview,
  };
}

export async function fetchTrending(page = 1, perPage = 24): Promise<Gif[]> {
  const cid = getCustomerId();
  const res = await fetch(
    `${BASE}/${APP_KEY}/gifs/trending?customer_id=${cid}&page=${page}&per_page=${perPage}`
  );
  if (!res.ok) throw new Error(`Klipy trending error: ${res.status}`);
  const json = await res.json();
  if (!json?.data?.data || !Array.isArray(json.data.data)) {
    throw new Error("Klipy trending: unexpected response shape");
  }
  return (json as KlipyResponse).data.data.map(mapItem);
}

export async function fetchSearch(q: string, page = 1): Promise<Gif[]> {
  const cid = getCustomerId();
  const res = await fetch(
    `${BASE}/${APP_KEY}/gifs/search?q=${encodeURIComponent(q)}&customer_id=${cid}&page=${page}&per_page=24`
  );
  if (!res.ok) throw new Error(`Klipy search error: ${res.status}`);
  const json = await res.json();
  if (!json?.data?.data || !Array.isArray(json.data.data)) {
    throw new Error("Klipy search: unexpected response shape");
  }
  return (json as KlipyResponse).data.data.map(mapItem);
}
