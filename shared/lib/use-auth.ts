"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { API_BASE } from "./api-base";

type AuthState = {
  isLoggedIn: boolean;
  checked: boolean;
  email: string | null;
};

const INITIAL_AUTH_STATE: AuthState = {
  isLoggedIn: false,
  checked: false,
  email: null,
};

let authState = INITIAL_AUTH_STATE;
let authRequest: Promise<AuthState> | null = null;
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
  if (!force && authState.checked) return authState;
  if (authRequest) return authRequest;

  authRequest = fetch(`${API_BASE}/users/me`, { credentials: "include" })
    .then(async (response) => {
      if (!response.ok) {
        return { isLoggedIn: false, checked: true, email: null };
      }
      const data = await response.json();
      return {
        isLoggedIn: true,
        checked: true,
        email: typeof data.email === "string" ? data.email : null,
      };
    })
    .catch(() => ({ isLoggedIn: false, checked: true, email: null }))
    .then((next) => {
      setAuthState(next);
      return next;
    })
    .finally(() => {
      authRequest = null;
    });

  return authRequest;
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
        credentials: "include",
        ...init,
      });

      if (res.status === 401 || res.status === 403) {
        setAuthState({ isLoggedIn: false, checked: true, email: null });
      }

      return res;
    },
    [],
  );

  const checkAuth = useCallback(async (): Promise<boolean> => {
    return (await loadAuth(true)).isLoggedIn;
  }, []);

  return {
    isLoggedIn: auth.isLoggedIn,
    checked: auth.checked,
    email: auth.email,
    authFetch,
    checkAuth,
  };
}
