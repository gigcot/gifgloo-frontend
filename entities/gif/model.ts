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
  id: string; // slug 사용
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
    if (parsed && typeof parsed.id === "string" && typeof parsed.slug === "string") {
      return parsed as Gif;
    }
  } catch { /* malformed */ }
  return null;
}
