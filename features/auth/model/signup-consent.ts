import { API_BASE } from "@/shared/lib/api-base";

export const CURRENT_TERMS_VERSION = "2026-08-09";
export const CURRENT_PRIVACY_VERSION = "2026-08-09";

const PENDING_SIGNUP_CONSENT_KEY = "gifgloo_pending_signup_consent";

export type RecordSignupConsentCommand = {
  terms_version: string;
  privacy_version: string;
  is_fourteen_or_older: true;
};

export function savePendingSignupConsent(): void {
  const command: RecordSignupConsentCommand = {
    terms_version: CURRENT_TERMS_VERSION,
    privacy_version: CURRENT_PRIVACY_VERSION,
    is_fourteen_or_older: true,
  };
  sessionStorage.setItem(PENDING_SIGNUP_CONSENT_KEY, JSON.stringify(command));
}

export function readPendingSignupConsent(): RecordSignupConsentCommand | null {
  const raw = sessionStorage.getItem(PENDING_SIGNUP_CONSENT_KEY);
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof value !== "object" ||
    value === null ||
    !("terms_version" in value) ||
    !("privacy_version" in value) ||
    !("is_fourteen_or_older" in value) ||
    value.terms_version !== CURRENT_TERMS_VERSION ||
    value.privacy_version !== CURRENT_PRIVACY_VERSION ||
    value.is_fourteen_or_older !== true
  ) {
    return null;
  }

  return {
    terms_version: value.terms_version,
    privacy_version: value.privacy_version,
    is_fourteen_or_older: true,
  };
}

export function clearPendingSignupConsent(): void {
  sessionStorage.removeItem(PENDING_SIGNUP_CONSENT_KEY);
}

export async function recordSignupConsent(
  command: RecordSignupConsentCommand,
): Promise<"recorded" | "unsupported"> {
  const response = await fetch(`${API_BASE}/users/me/consents`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });

  if (response.status === 404) return "unsupported";
  if (!response.ok) throw new Error("가입 동의 정보를 저장하지 못했습니다");
  return "recorded";
}
