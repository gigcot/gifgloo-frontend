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
  | { type: "error"; message: string };

type AuthFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const STATUS_MESSAGES: Record<number, string> = {
  400: "요청이 올바르지 않아요. 다시 시도해주세요.",
  402: "크레딧이 부족해요. 충전 후 다시 시도해주세요.",
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
  const form = new FormData();
  form.append("gif_url", getGifUrl(gif, "hd"));
  form.append("target_file", photoFile);
  if (confirmed) form.append("acknowledge_frame_reduction", "true");

  try {
    const res = await authFetch(`${API_BASE}/compositions`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);

      if (res.status === 422 && body?.error === "CONFIRMATION_REQUIRED") {
        return {
          type: "confirmation",
          confirmation: { code: body.code, message: body.message, proposal: body.proposal },
        };
      }

      if (res.status === 401 || res.status === 403) {
        return { type: "auth_required" };
      }

      const friendlyMessage = STATUS_MESSAGES[res.status] ?? "합성에 실패했어요. 잠시 후 다시 시도해주세요.";
      return { type: "error", message: friendlyMessage };
    }

    const data = await res.json();
    if (typeof data.composition_job_id !== "string") {
      return { type: "error", message: "서버 응답이 올바르지 않습니다. 잠시 후 다시 시도해주세요." };
    }

    return { type: "job", jobId: data.composition_job_id };
  } catch {
    return { type: "error", message: "네트워크 오류가 발생했어요. 인터넷 연결을 확인해주세요." };
  }
}
