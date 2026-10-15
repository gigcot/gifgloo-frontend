export async function copyShareUrl(shareUrl: string | Promise<string>): Promise<void> {
  const text = Promise.resolve(shareUrl);
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    // Keep the clipboard call in the click gesture while the share API is still pending.
    const blob = text.then(value => new Blob([value], { type: "text/plain" }));
    const write = new Promise<void>((resolve, reject) => {
      navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]).then(resolve, reject);
    });
    await Promise.all([blob, write]);
  } else {
    await navigator.clipboard.writeText(await text);
  }
}
