"use client";

import { useState } from "react";
import { AdminAuthProvider, useAdminAuth } from "@/lib/adminAuth";
import { resolveOrgSlug } from "@/lib/api";

function LoginGate({ children }: { children: React.ReactNode }) {
  const { token, role, login, logout } = useAdminAuth();
  const [orgSlug, setOrgSlug] = useState(resolveOrgSlug() || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    setError("");
    try {
      const result = await login(orgSlug, email, password, mfaRequired ? mfaCode : undefined);
      if (result.mfaRequired) {
        setMfaRequired(true);
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  }

  if (!token) {
    return (
      <div className="container">
        <h1 style={{ fontSize: 18 }}>Admin login</h1>
        <div className="field">
          <label>Organization slug</label>
          <input
            className="text-input"
            value={orgSlug}
            onChange={(e) => setOrgSlug(e.target.value)}
            placeholder="quickcart-lagos"
            disabled={mfaRequired}
          />
        </div>
        <div className="field">
          <label>Email</label>
          <input className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={mfaRequired} />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="text-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !mfaRequired && handleLogin()}
            disabled={mfaRequired}
          />
        </div>
        {mfaRequired && (
          <div className="field">
            <label>Two-factor code (from your authenticator app)</label>
            <input
              className="text-input"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              maxLength={6}
              autoFocus
            />
          </div>
        )}
        {error && <p style={{ color: "#a32d2d", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button className="btn" onClick={handleLogin}>
          {mfaRequired ? "Verify and sign in" : "Sign in"}
        </button>
        <p style={{ marginTop: 12 }}>
          <a href="/admin/forgot-password" className="muted" style={{ fontSize: 13 }}>
            Forgot your password?
          </a>
          {" · "}
          <a href="/admin/signup" className="muted" style={{ fontSize: 13 }}>
            Create an account
          </a>
        </p>
      </div>
    );
  }

  const links = [
    { href: "/admin/orders", label: "Orders", roles: ["owner", "manager", "support"] },
    { href: "/admin/reports", label: "Reports", roles: ["owner", "manager"] },
    { href: "/admin/products", label: "Products", roles: ["owner", "manager"] },
    { href: "/admin/supermarkets", label: "Supermarkets", roles: ["owner", "manager"] },
    { href: "/admin/team", label: "Team", roles: ["owner"] },
    { href: "/admin/settings", label: "Settings", roles: ["owner"] },
    { href: "/admin/audit-log", label: "Audit log", roles: ["owner"] },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "10px 16px",
          borderBottom: "1px solid #d8dee3",
          fontSize: 13,
          alignItems: "center",
        }}
      >
        {links
          .filter((l) => !role || l.roles.includes(role))
          .map((l) => (
            <a key={l.href} href={l.href} className="muted">
              {l.label}
            </a>
          ))}
        <span style={{ flex: 1 }} />
        <button
          onClick={logout}
          style={{ background: "none", border: "none", color: "#5b6670", fontSize: 13, cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <LoginGate>{children}</LoginGate>
    </AdminAuthProvider>
  );
}
