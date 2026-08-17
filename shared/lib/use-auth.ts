"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "./api-base";

type AuthState = {
  isLoggedIn: boolean;
  checked: boolean;
  email: string | null;
};

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    isLoggedIn: false,
    checked: false,
    email: null,
  });

  useEffect(() => {
    fetch(`${API_BASE}/users/me`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          setAuth({ isLoggedIn: false, checked: true, email: null });
          return;
        }
        const data = await res.json();
        setAuth({
          isLoggedIn: true,
          checked: true,
          email: typeof data.email === "string" ? data.email : null,
        });
      })
      .catch(() => setAuth({ isLoggedIn: false, checked: true, email: null }));
  }, []);

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, {
        credentials: "include",
        ...init,
      });

      if (res.status === 401 || res.status === 403) {
        setAuth({ isLoggedIn: false, checked: true, email: null });
      }

      return res;
    },
    [],
  );

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/users/me`, { credentials: "include" });
      const ok = res.ok;
      if (!ok) {
        setAuth({ isLoggedIn: false, checked: true, email: null });
        return false;
      }
      const data = await res.json();
      setAuth({
        isLoggedIn: true,
        checked: true,
        email: typeof data.email === "string" ? data.email : null,
      });
      return ok;
    } catch {
      setAuth({ isLoggedIn: false, checked: true, email: null });
      return false;
    }
  }, []);

  return {
    isLoggedIn: auth.isLoggedIn,
    checked: auth.checked,
    email: auth.email,
    authFetch,
    checkAuth,
  };
}
