type GifFormat = {
  url: string;
  width: number;
  height: number;
  size: number;
};

type GifSizes = {
  gif?: GifFormat;
  webp?: GifFormat;
  mp4?: GifFormat;
};

export type Gif = {
  id: string;
  slug: string;
  title: string;
  file: {
    hd: GifSizes;
    md: GifSizes;
    sm: GifSizes;
    xs: GifSizes;
  };
  blur_preview: string;
};

export function getGifUrl(gif: Gif, size: "hd" | "md" | "sm" | "xs" = "md"): string {
  return (
    gif.file[size]?.gif?.url ??
    gif.file.md?.gif?.url ??
    gif.file.sm?.gif?.url ??
    gif.file.hd?.gif?.url ??
    ""
  );
}

export function safeParseGif(raw: string): Gif | null {
  try {
    const parsed = JSON.parse(raw);
    if (isGif(parsed)) return parsed;
  } catch { /* malformed */ }
  return null;
}

export function isGif(value: unknown): value is Gif {
  if (!value || typeof value !== "object") return false;
  const gif = value as Record<string, unknown>;
  if (typeof gif.id !== "string" || typeof gif.slug !== "string" || typeof gif.title !== "string" ||
    !gif.file || typeof gif.file !== "object") return false;
  const files = gif.file as Record<string, unknown>;
  for (const size of ["hd", "md", "sm", "xs"]) {
    const formats = files[size];
    if (!formats || typeof formats !== "object") return false;
    for (const kind of ["gif", "webp", "mp4"]) {
      const format = (formats as Record<string, unknown>)[kind];
      if (format === undefined) continue;
      if (!format || typeof format !== "object") return false;
      const media = format as Record<string, unknown>;
      if (typeof media.url !== "string" || typeof media.width !== "number" || typeof media.height !== "number" ||
        !Number.isFinite(media.width) || !Number.isFinite(media.height) || media.width <= 0 || media.height <= 0) return false;
    }
  }
  return true;
}
