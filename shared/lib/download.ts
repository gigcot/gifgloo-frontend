export function downloadGif(downloadUrl: string): void {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
