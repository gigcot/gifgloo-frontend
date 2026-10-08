import { countGifFrames } from "./gif-frame-parser";

self.onmessage = async ({ data: url }: MessageEvent<string>) => {
  try {
    const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(12000) });
    if (!response.ok || !response.body) throw new Error("fetch");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 20 * 1024 * 1024) { await reader.cancel(); throw new Error("size"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
    self.postMessage({ status: "ready", count: countGifFrames(bytes) });
  } catch { self.postMessage({ status: "error" }); }
};
