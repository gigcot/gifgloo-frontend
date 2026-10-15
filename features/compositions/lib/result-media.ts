import { decompressFrame, parseGIF } from "gifuct-js";

export type ResultFrame = {
  bitmap: ImageBitmap;
  png: Blob;
  thumbnailUrl: string;
  delay: number;
};

export type DecodedResult = {
  width: number;
  height: number;
  previewWidth: number;
  previewHeight: number;
  frames: ResultFrame[];
};

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("이미지를 만들지 못했어요.")), "image/png");
  });
}

export async function decodeResult(file: Blob, signal: AbortSignal): Promise<DecodedResult> {
  if (file.size > 64 * 1024 * 1024) throw new Error("이 결과는 장면을 펼치기에 너무 커요. GIF로 저장해주세요.");
  const bytes = await file.arrayBuffer();
  signal.throwIfAborted();
  const signature = new TextDecoder().decode(bytes.slice(0, 6));
  if (signature !== "GIF87a" && signature !== "GIF89a") throw new Error("GIF 장면을 읽지 못했어요. 원본 결과는 아래에서 저장할 수 있어요.");
  const gif = parseGIF(bytes);
  const images = gif.frames.filter(frame => "image" in frame);
  const { width, height } = gif.lsd;
  if (!images.length || width < 1 || height < 1) throw new Error("GIF에 표시할 장면이 없어요.");
  if (width > 4096 || height > 4096 || images.length > 120 || width * height * images.length > 100_000_000) {
    throw new Error("이 결과는 장면을 펼치기에 너무 커요. GIF로 저장해주세요.");
  }
  const scale = Math.min(1, 840 / Math.max(width, height));
  const previewWidth = Math.max(1, Math.round(width * scale));
  const previewHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const patchCanvas = document.createElement("canvas");
  const patchContext = patchCanvas.getContext("2d");
  const thumb = document.createElement("canvas");
  const thumbScale = Math.min(1, 128 / Math.max(width, height));
  thumb.width = Math.max(1, Math.round(width * thumbScale));
  thumb.height = Math.max(1, Math.round(height * thumbScale));
  const thumbContext = thumb.getContext("2d");
  if (!context || !patchContext || !thumbContext) throw new Error("이 브라우저에서는 장면을 추출할 수 없어요. GIF로 저장해주세요.");
  const frames: ResultFrame[] = [];

  try {
    for (const image of images) {
      signal.throwIfAborted();
      const dims = image.image.descriptor;
      if (dims.width < 1 || dims.height < 1 || dims.left + dims.width > width || dims.top + dims.height > height) {
        throw new Error("GIF 장면의 크기가 올바르지 않아요.");
      }
      const patch = decompressFrame(image, gif.gct, true);
      const previous = patch.disposalType === 3 ? context.getImageData(0, 0, width, height) : null;
      patchCanvas.width = dims.width;
      patchCanvas.height = dims.height;
      patchContext.putImageData(new ImageData(new Uint8ClampedArray(patch.patch), dims.width, dims.height), 0, 0);
      context.drawImage(patchCanvas, dims.left, dims.top);
      const png = await canvasPng(canvas);
      thumbContext.clearRect(0, 0, thumb.width, thumb.height);
      thumbContext.drawImage(canvas, 0, 0, thumb.width, thumb.height);
      const thumbnail = await canvasPng(thumb);
      const bitmap = await createImageBitmap(canvas, { resizeWidth: previewWidth, resizeHeight: previewHeight, resizeQuality: "high" });
      frames.push({ bitmap, png, thumbnailUrl: URL.createObjectURL(thumbnail), delay: Math.max(patch.delay || 100, 20) });
      if (patch.disposalType === 2) context.clearRect(dims.left, dims.top, dims.width, dims.height);
      if (previous) context.putImageData(previous, 0, 0);
    }
    signal.throwIfAborted();
    return { width, height, previewWidth, previewHeight, frames };
  } catch (error) {
    releaseResult({ frames });
    throw error;
  }
}

export function releaseResult(result: Pick<DecodedResult, "frames">) {
  for (const frame of result.frames) {
    frame.bitmap.close();
    URL.revokeObjectURL(frame.thumbnailUrl);
  }
}

export async function encodeResultMp4(result: DecodedResult, onProgress: (progress: number) => void, signal: AbortSignal): Promise<File> {
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, canEncodeVideo, Quality } = await import("mediabunny");
  signal.throwIfAborted();
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(result.width / 2) * 2;
  canvas.height = Math.ceil(result.height / 2) * 2;
  const quality = new Quality({ bitrate: 4_000_000 });
  if (!await canEncodeVideo("avc", { width: canvas.width, height: canvas.height, quality })) {
    throw new Error("이 브라우저에서는 MP4 변환을 지원하지 않아요. GIF로 저장하거나 다른 브라우저에서 열어주세요.");
  }
  signal.throwIfAborted();
  const context = canvas.getContext("2d");
  if (!context) throw new Error("MP4를 만들지 못했어요. GIF로 저장해주세요.");
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: "avc", quality });
  output.addVideoTrack(source);
  try {
    await output.start();
    let timestamp = 0;
    for (let index = 0; index < result.frames.length; index++) {
      signal.throwIfAborted();
      const frame = result.frames[index];
      const bitmap = await createImageBitmap(frame.png);
      try {
        signal.throwIfAborted();
        context.fillStyle = "#000000";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0);
        await source.add(timestamp, frame.delay / 1000);
      } finally {
        bitmap.close();
      }
      timestamp += frame.delay / 1000;
      onProgress(Math.round((index + 1) / result.frames.length * 100));
    }
    await output.finalize();
    signal.throwIfAborted();
    if (!output.target.buffer) throw new Error("MP4를 만들지 못했어요. 다시 시도해주세요.");
    return new File([output.target.buffer], "gifgloo-result.mp4", { type: "video/mp4" });
  } catch (error) {
    if (output.state !== "finalized" && output.state !== "canceled") await output.cancel();
    throw error;
  }
}

export function downloadResultFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
