"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "./api";
import { decodeJwtPayload } from "./jwt";

interface AdminAuthState {
  token: string | null;
  role: string | null;
  // Returns true if the backend needs an MFA code before it will issue a
  // token — the caller (the login form) should then prompt for a code and
  // call login() again with mfaToken set, using the SAME credentials.
  login: (organizationSlug: string, email: string, password: string, mfaToken?: string) => Promise<{ mfaRequired: boolean }>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

// Token lives in React state only, not localStorage — a page refresh means
// signing in again. Same trade-off the lean pilot's admin page made: fine
// for how few people touch this today, revisit if it becomes annoying.
export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  async function login(organizationSlug: string, email: string, password: string, mfaToken?: string) {
    const data = await api.post("/auth/login", { organizationSlug, email, password, mfaToken });
    if (data.mfaRequired) {
      return { mfaRequired: true };
    }
    const payload = decodeJwtPayload(data.token);
    setToken(data.token);
    setRole(payload?.role ?? null);
    return { mfaRequired: false };
  }

  function logout() {
    setToken(null);
    setRole(null);
  }

  return (
    <AdminAuthContext.Provider value={{ token, role, login, logout }}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
