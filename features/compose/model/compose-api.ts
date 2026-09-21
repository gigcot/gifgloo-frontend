import type { Gif } from "@/entities/gif/model";
import { getGifUrl } from "@/entities/gif/model";
import { API_BASE } from "@/shared/lib/api-base";

export type Confirmation = {
  code: string;
  message: string;
  proposal: Record<string, unknown>;
};

export type SubmitResult =
  | { type: "job"; jobId: string }
  | { type: "confirmation"; confirmation: Confirmation }
  | { type: "auth_required" }
  | { type: "insufficient_credit" }
  | { type: "composition_unavailable"; retryAfterSeconds: number | null }
  | { type: "error"; message: string };

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type PreparedUpload = {
  uploadId: string;
};

const preparedUploads = new WeakMap<File, PreparedUpload>();

async function prepareDirectUpload(
  authFetch: AuthFetch,
  file: File,
): Promise<PreparedUpload | SubmitResult> {
  const existing = preparedUploads.get(file);
  if (existing) return existing;

  const { prepareImageUpload } = await import("@/features/compose/model/prepare-image-upload");
  const image = await prepareImageUpload(file);
  const prepareResponse = await authFetch(`${API_BASE}/compositions/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: image.type, size: image.size }),
  });
  if (!prepareResponse.ok) {
    const body = await prepareResponse.json().catch(() => null);
    return {
      type: "error",
      message: typeof body?.message === "string"
        ? body.message
        : STATUS_MESSAGES[prepareResponse.status] ?? "이미지 업로드를 준비하지 못했습니다.",
    };
  }

  const prepared = await prepareResponse.json();
  if (
    typeof prepared.upload_id !== "string" ||
    typeof prepared.upload_url !== "string" ||
    typeof prepared.headers !== "object" ||
    prepared.headers === null
  ) {
    return { type: "error", message: "이미지 업로드 응답이 올바르지 않습니다." };
  }

  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(prepared.upload_url, {
      method: "PUT",
      headers: prepared.headers as Record<string, string>,
      body: image,
    });
  } catch {
    return { type: "error", message: "이미지를 업로드하지 못했습니다. 네트워크를 확인해주세요." };
  }
  if (!uploadResponse.ok) {
    return { type: "error", message: "이미지를 업로드하지 못했습니다. 다시 시도해주세요." };
  }

  const result = { uploadId: prepared.upload_id };
  preparedUploads.set(file, result);
  return result;
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "요청이 올바르지 않아요. 다시 시도해주세요.",
  402: "사용 가능한 합성 이용권이 없어요.",
  413: "파일 크기가 너무 커요. 더 작은 이미지를 사용해주세요.",
  429: "요청이 너무 많아요. 잠시 후 다시 시도해주세요.",
  500: "서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
  502: "서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.",
  503: "서버가 일시적으로 불안정해요. 잠시 후 다시 시도해주세요.",
};

export async function submitComposition(
  authFetch: AuthFetch,
  gif: Gif,
  photoFile: File,
  confirmed: boolean
): Promise<SubmitResult> {
  try {
    const upload = await prepareDirectUpload(authFetch, photoFile);
    if ("type" in upload) return upload;

    const res = await authFetch(`${API_BASE}/compositions/from-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gif_url: getGifUrl(gif, "hd"),
        upload_id: upload.uploadId,
        acknowledge_frame_reduction: confirmed,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);

      if (res.status === 429 && body?.error === "COMPOSITION_UNAVAILABLE") {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfter = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
        return {
          type: "composition_unavailable",
          retryAfterSeconds: Number.isInteger(retryAfter) && retryAfter > 0 ? retryAfter : null,
        };
      }

      if (res.status === 422 && body?.error === "CONFIRMATION_REQUIRED") {
        return {
          type: "confirmation",
          confirmation: { code: body.code, message: body.message, proposal: body.proposal },
        };
      }

      if (res.status === 401 || res.status === 403) {
        return { type: "auth_required" };
      }

      if (res.status === 402) {
        return { type: "insufficient_credit" };
      }

      const friendlyMessage = STATUS_MESSAGES[res.status] ?? "합성에 실패했어요. 잠시 후 다시 시도해주세요.";
      return { type: "error", message: friendlyMessage };
    }

    const data = await res.json();
    if (typeof data.composition_job_id !== "string") {
      return { type: "error", message: "서버 응답이 올바르지 않습니다. 잠시 후 다시 시도해주세요." };
    }

    preparedUploads.delete(photoFile);

    return { type: "job", jobId: data.composition_job_id };
  } catch (error) {
    return {
      type: "error",
      message: error instanceof Error
        ? error.message
        : "네트워크 오류가 발생했어요. 인터넷 연결을 확인해주세요.",
    };
  }
}
