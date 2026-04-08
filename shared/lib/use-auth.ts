"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "./api-base";

type AuthState = {
  isLoggedIn: boolean;
  checked: boolean;
};

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ isLoggedIn: false, checked: false });

  useEffect(() => {
    fetch(`${API_BASE}/users/me`, { credentials: "include" })
      .then((res) => setAuth({ isLoggedIn: res.ok, checked: true }))
      .catch(() => setAuth({ isLoggedIn: false, checked: true }));
  }, []);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, {
        credentials: "include",
        ...init,
      });

      if (res.status === 401 || res.status === 403) {
        setAuth({ isLoggedIn: false, checked: true });
      }

      return res;
    },
    [],
  );

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, { credentials: "include" });
      const ok = res.ok;
      setAuth({ isLoggedIn: ok, checked: true });
      return ok;
    } catch {
      setAuth({ isLoggedIn: false, checked: true });
      return false;
    }
  }, []);

  return {
    isLoggedIn: auth.isLoggedIn,
    checked: auth.checked,
    authFetch,
    checkAuth,
  };
}
