import { trackEvent } from "@/shared/lib/umami";

export function downloadGif(downloadUrl: string, source: string, assetId?: string): void {
  trackEvent("result_downloaded", { source, ...(assetId ? { asset_id: assetId } : {}) });
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
