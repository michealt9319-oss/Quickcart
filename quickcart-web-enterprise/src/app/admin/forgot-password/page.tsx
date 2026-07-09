"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { resolveOrgSlug } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [orgSlug, setOrgSlug] = useState(resolveOrgSlug() || "");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const data = await api.post("/auth/forgot-password", { organizationSlug: orgSlug, email });
      setMessage(data.message || "If that account exists, a reset email has been sent.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: 18 }}>Reset your password</h1>
      <div className="field">
        <label>Organization slug</label>
        <input className="text-input" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} />
      </div>
      <div className="field">
        <label>Email</label>
        <input className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}
      {message && <p style={{ color: "#0f6e56", fontSize: 13 }}>{message}</p>}
      <button className="btn" onClick={submit} disabled={submitting}>
        {submitting ? "Sending…" : "Send reset link"}
      </button>
      <p style={{ marginTop: 12 }}>
        <a href="/admin/orders" className="muted" style={{ fontSize: 13 }}>
          ← Back to login
        </a>
      </p>
    </div>
  );
}
