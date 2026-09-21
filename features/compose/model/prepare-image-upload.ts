const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2048;
const JPEG_QUALITY = 0.9;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function contentTypeFor(file: File): string {
  if (ALLOWED_CONTENT_TYPES.has(file.type)) return file.type;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  throw new Error("지원하지 않는 이미지 형식입니다");
}

export function isSupportedImageFile(file: File): boolean {
  try {
    contentTypeFor(file);
    return true;
  } catch {
    return false;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("이미지를 변환하지 못했습니다")),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export async function prepareImageUpload(file: File): Promise<Blob> {
  const contentType = contentTypeFor(file);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("이미지는 최대 15MB까지 업로드할 수 있습니다");
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 변환하지 못했습니다");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await canvasToBlob(canvas);
  } catch {
    return new File([file], file.name, { type: contentType });
  }
}
