export async function copyShareUrl(shareUrl: string): Promise<void> {
  await navigator.clipboard.writeText(shareUrl);
}
