"use client";

import { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { api } from "./api";
import { decodeJwtPayload } from "./jwt";

interface AdminAuthState {
  token: string | null;
  role: string | null;
  refresh: () => Promise<void>;
  // Returns true if the backend needs an MFA code before it will issue a
  // token — the caller (the login form) should then prompt for a code and
  // call login() again with mfaToken set, using the SAME credentials.
  login: (organizationSlug: string, email: string, password: string, mfaToken?: string) => Promise<{ mfaRequired: boolean }>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

// Token lives in React state only, not localStorage — a page refresh means
// signing in again. Same trade-off the lean pilot's admin page made: fine
// for how few people touch this today, revisit if it becomes annoying.
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing timer when token changes
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!token) return;
    const payload = decodeJwtPayload(token);
    const exp = payload?.exp ? Number(payload.exp) * 1000 : null;
    if (!exp) return;
    const now = Date.now();
    const msUntilRefresh = Math.max(1000, exp - now - 60 * 1000); // refresh 60s before expiry
    refreshTimerRef.current = window.setTimeout(() => {
      // fire-and-forget; errors are ignored here
      refresh().catch(() => {});
    }, msUntilRefresh);
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function login(organizationSlug: string, email: string, password: string, mfaToken?: string) {
    const data = await api.post("/auth/login", { organizationSlug, email, password, mfaToken });
    if (data.mfaRequired) {
      return { mfaRequired: true };
    }
    const payload = decodeJwtPayload(data.token);
    setToken(data.token);
    setRefreshToken(data.refreshToken ?? null);
    setRole(payload?.role ?? null);
    return { mfaRequired: false };
  }

  async function refresh() {
    if (!refreshToken) throw new Error("no refresh token");
    const data = await api.post("/auth/refresh", { refreshToken });
    const payload = decodeJwtPayload(data.token);
    setToken(data.token);
    setRefreshToken(data.refreshToken ?? null);
    setRole(payload?.role ?? null);
  }

  async function logout() {
    try {
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } catch {
      // ignore failures on logout
    }
    setToken(null);
    setRole(null);
    setRefreshToken(null);
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }

  return (
    <AdminAuthContext.Provider value={{ token, role, refresh, login, logout }}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
