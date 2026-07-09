"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const orgSlug = searchParams.get("org") || "";

  const [newPassword, setNewPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (newPassword.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { organizationSlug: orgSlug, token, newPassword });
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token || !orgSlug) {
    return <p className="muted">This reset link is missing required information. Request a new one.</p>;
  }

  if (done) {
    return (
      <>
        <h1 style={{ fontSize: 18 }}>Password updated</h1>
        <p className="muted">You can now sign in with your new password.</p>
        <a href="/admin/orders" className="btn" style={{ display: "inline-block", marginTop: 12 }}>
          Go to login
        </a>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 18 }}>Set a new password</h1>
      <div className="field">
        <label>New password (min. 10 characters)</label>
        <input className="text-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={submitting}>
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container">
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
