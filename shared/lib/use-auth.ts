"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { API_BASE } from "./api-base";
import { getCampaignAttribution } from "./campaign-attribution";
import { trackEvent } from "./umami";

type AuthState = {
  status: "checking" | "visitor" | "anonymous" | "member" | "error";
  userId: string | null;
  email: string | null;
  consentRequired: boolean;
};

const INITIAL_AUTH_STATE: AuthState = {
  status: "checking",
  userId: null,
  email: null,
  consentRequired: false,
};

let authState = INITIAL_AUTH_STATE;
let authRequest: Promise<AuthState> | null = null;
let sessionRequest: Promise<AuthState> | null = null;
const VISITOR: AuthState = { ...INITIAL_AUTH_STATE, status: "visitor" };
const authListeners = new Set<() => void>();

function setAuthState(next: AuthState): void {
  authState = next;
  for (const listener of authListeners) listener();
}

function subscribe(listener: () => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

function getAuthSnapshot(): AuthState {
  return authState;
}

async function loadAuth(force = false): Promise<AuthState> {
  if (!force && authState.status !== "checking") return authState;
  if (authRequest) return authRequest;

  authRequest = fetch(`${API_BASE}/users/me`, { credentials: "include" })
    .then(async (response) => {
      if (response.status === 401) return VISITOR;
      if (!response.ok) throw new Error("세션을 확인하지 못했어요.");
      return parseUser(await response.json());
    })
    .catch((): AuthState => ({ ...VISITOR, status: "error" }))
    .then((next) => {
      setAuthState(next);
      return next;
    })
    .finally(() => {
      authRequest = null;
    });

  return authRequest;
}

function parseUser(data: { user_id: string; user_kind?: string; email?: string; consent_required?: boolean }): AuthState {
  if (typeof data.user_id !== "string" || !data.user_id) throw new Error("사용자 응답을 확인하지 못했어요.");
  // 배포 전 기존 회원 응답에는 user_kind가 없다.
  const kind = data.user_kind ?? "member";
  if (kind !== "member" && kind !== "anonymous") throw new Error("사용자 종류를 확인하지 못했어요.");
  return { status: kind, userId: data.user_id, email: data.email ?? null, consentRequired: data.consent_required === true };
}

async function prepareSession(): Promise<AuthState> {
  const existing = await loadAuth(true);
  if (existing.status === "anonymous" || existing.status === "member") {
    trackEvent("anonymous_session_ready", { created: false, user_kind: existing.status });
    return existing;
  }
  if (existing.status === "error") throw new Error("접속을 확인하지 못했어요. 다시 시도해 주세요.");
  const campaign = getCampaignAttribution();
  for (let step = 0; step < 2; step += 1) {
    const response = await fetch(`${API_BASE}/users/anonymous-session`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acquisition: campaign.utm_campaign ? {
        source: campaign.utm_source, medium: campaign.utm_medium,
        campaign: campaign.utm_campaign, content: campaign.utm_content,
      } : undefined }),
    });
    if (response.status === 202) continue;
    if (!response.ok) throw new Error("체험 준비에 실패했어요. 입력은 유지되니 다시 시도해 주세요.");
    const data = await response.json();
    if (data.ready !== true) throw new Error("체험 준비 응답을 확인하지 못했어요.");
    const next = parseUser(data);
    setAuthState(next);
    trackEvent("anonymous_session_ready", { created: data.created === true, user_kind: next.status });
    return next;
  }
  throw new Error("이 브라우저에서 쿠키를 사용할 수 없어요. 쿠키 설정을 확인한 뒤 다시 시도해 주세요.");
}

export function ensureUserSession(): Promise<AuthState> {
  if (authState.status === "member" || authState.status === "anonymous") return Promise.resolve(authState);
  if (sessionRequest) return sessionRequest;
  const prepare = async (): Promise<AuthState> => navigator.locks
    ? await navigator.locks.request("gifgloo-user-session", prepareSession)
    : await prepareSession();
  sessionRequest = prepare()
    .catch((error) => { trackEvent("anonymous_session_failed"); throw error; })
    .finally(() => { sessionRequest = null; });
  return sessionRequest;
}

export function useAuth() {
  const auth = useSyncExternalStore(
    subscribe,
    getAuthSnapshot,
    () => INITIAL_AUTH_STATE,
  );

  useEffect(() => {
    void loadAuth();
  }, []);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, {
        ...init,
        credentials: "include",
      });

      if (res.status === 401) setAuthState(VISITOR);

      return res;
    },
    [],
  );

  const checkAuth = useCallback(async (): Promise<boolean> => {
    return (await loadAuth(true)).status === "member";
  }, []);

  return {
    isLoggedIn: auth.status === "member",
    isAnonymous: auth.status === "anonymous",
    hasUserSession: auth.status === "member" || auth.status === "anonymous",
    checked: auth.status !== "checking",
    status: auth.status,
    consentRequired: auth.consentRequired,
    userId: auth.userId,
    email: auth.email,
    authFetch,
    checkAuth,
    ensureSession: ensureUserSession,
    refreshAuth: useCallback(() => loadAuth(true), []),
  };
}
