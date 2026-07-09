"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function SignupPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function submit() {
    if (!organizationName || !organizationSlug || !ownerEmail || ownerPassword.length < 10) {
      setError("All fields are required, and the password must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/organizations/signup", {
        organizationName,
        organizationSlug,
        ownerEmail,
        ownerPassword,
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="container">
        <h1 style={{ fontSize: 18 }}>Check your email</h1>
        <p className="muted">
          We've created your organization and sent a verification link to {ownerEmail}. Once
          verified, sign in at{" "}
          <a href="/admin/orders" className="muted">
            /admin/orders
          </a>{" "}
          using your organization slug (<strong>{organizationSlug}</strong>), email, and password.
        </p>
        <p className="muted" style={{ fontSize: 13 }}>
          Note: verification isn't currently required to log in — see the backend README's note
          on <code>email_verified</code> if you want to enforce that before launch.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: 18 }}>Create your QuickCart account</h1>

      <div className="field">
        <label>Business / organization name</label>
        <input
          className="text-input"
          value={organizationName}
          onChange={(e) => {
            setOrganizationName(e.target.value);
            if (!organizationSlug) setOrganizationSlug(slugify(e.target.value));
          }}
        />
      </div>
      <div className="field">
        <label>Organization slug (used in your storefront URL / login)</label>
        <input
          className="text-input"
          value={organizationSlug}
          onChange={(e) => setOrganizationSlug(slugify(e.target.value))}
          placeholder="quickcart-lagos"
        />
      </div>
      <div className="field">
        <label>Your email</label>
        <input className="text-input" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Password (min. 10 characters)</label>
        <input
          className="text-input"
          type="password"
          value={ownerPassword}
          onChange={(e) => setOwnerPassword(e.target.value)}
        />
      </div>

      {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}

      <button className="btn" onClick={submit} disabled={submitting}>
        {submitting ? "Creating…" : "Create account"}
      </button>

      <p style={{ marginTop: 12 }}>
        <a href="/admin/orders" className="muted" style={{ fontSize: 13 }}>
          Already have an account? Sign in
        </a>
      </p>
    </div>
  );
}
