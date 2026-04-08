type ShareMethod = "file" | "url" | "clipboard";

/**
 * @param gifUrl  파일 공유 시 사용할 GIF CDN URL
 * @param shareUrl  URL/클립보드 공유 시 사용할 페이지 URL (OG 태그가 있는 페이지). 미제공 시 gifUrl 사용
 */
export async function shareGif(
  gifUrl: string,
  shareUrl?: string,
  filename = "gifgloo.gif",
): Promise<ShareMethod> {
  // 파일 공유 시도 (CORS 등 실패 시 URL 공유로 fallback)
  try {
    const blob = await fetch(gifUrl).then((r) => r.blob());
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Gifgloo" });
      return "file";
    }
  } catch { /* blob fetch 또는 파일 공유 실패 → fallback */ }

  const urlToShare = shareUrl ?? gifUrl;

  if (navigator.share) {
    await navigator.share({ url: urlToShare, title: "Gifgloo" });
    return "url";
  }

  await navigator.clipboard.writeText(urlToShare);
  return "clipboard";
}
