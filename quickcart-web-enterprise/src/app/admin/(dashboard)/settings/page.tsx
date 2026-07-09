"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";

export default function AdminSettingsPage() {
  const { token } = useAdminAuth();
  const [name, setName] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [convenienceFee, setConvenienceFee] = useState("");
  const [currency, setCurrency] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // MFA setup state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [mfaStatus, setMfaStatus] = useState<"idle" | "setting_up" | "enabled">("idle");

  async function save() {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await api.put(
        "/organizations/settings",
        {
          name: name || undefined,
          deliveryFee: deliveryFee ? Number(deliveryFee) : undefined,
          convenienceFee: convenienceFee ? Number(convenienceFee) : undefined,
          currency: currency || undefined,
        },
        { authToken: token }
      );
      setSaved(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function startMfaSetup() {
    if (!token) return;
    setMfaError("");
    try {
      const data = await api.post("/mfa/setup", {}, { authToken: token });
      setQrCode(data.qrCodeDataUrl);
      setMfaStatus("setting_up");
    } catch (err: any) {
      setMfaError(err.message);
    }
  }

  async function confirmMfa() {
    if (!token) return;
    setMfaError("");
    try {
      await api.post("/mfa/confirm", { token: mfaCode }, { authToken: token });
      setMfaStatus("enabled");
      setQrCode(null);
      setMfaCode("");
    } catch (err: any) {
      setMfaError(err.message);
    }
  }

  async function disableMfa() {
    if (!token) return;
    await api.post("/mfa/disable", {}, { authToken: token });
    setMfaStatus("idle");
  }

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 18 }}>Organization settings</h1>
      <p className="muted" style={{ fontSize: 13 }}>
        Leave a field blank to keep it unchanged. Leaving both fees blank keeps the platform
        default from the backend's pricing config.
      </p>

      <div className="field">
        <label>Organization name</label>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="(unchanged)" />
      </div>
      <div className="field">
        <label>Delivery fee override (₦)</label>
        <input className="text-input" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="(platform default)" />
      </div>
      <div className="field">
        <label>Convenience fee override (₦)</label>
        <input className="text-input" value={convenienceFee} onChange={(e) => setConvenienceFee(e.target.value)} placeholder="(platform default)" />
      </div>
      <div className="field">
        <label>Currency (3-letter code)</label>
        <input
          className="text-input"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          placeholder="NGN"
          maxLength={3}
        />
      </div>

      {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}
      {saved && <p style={{ color: "#0f6e56", fontSize: 13 }}>Saved.</p>}

      <button className="btn" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>

      <h2 style={{ fontSize: 16, marginTop: 32 }}>Two-factor authentication</h2>
      <p className="muted" style={{ fontSize: 13 }}>
        Adds a 6-digit code from an authenticator app (Google Authenticator, Authy, etc.) to your
        own login, on top of your password.
      </p>

      {mfaStatus === "idle" && (
        <button className="btn secondary" onClick={startMfaSetup}>
          Set up two-factor authentication
        </button>
      )}

      {mfaStatus === "setting_up" && qrCode && (
        <div style={{ border: "1px solid #d8dee3", borderRadius: 8, padding: 16 }}>
          <p style={{ fontSize: 13, marginTop: 0 }}>Scan this with your authenticator app:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrCode} alt="MFA QR code" style={{ width: 180, height: 180 }} />
          <div className="field" style={{ marginTop: 12 }}>
            <label>Enter the 6-digit code it shows</label>
            <input className="text-input" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} maxLength={6} />
          </div>
          {mfaError && <p style={{ color: "#a32d2d", fontSize: 13 }}>{mfaError}</p>}
          <button className="btn" onClick={confirmMfa}>
            Confirm and enable
          </button>
        </div>
      )}

      {mfaStatus === "enabled" && (
        <div>
          <p style={{ color: "#0f6e56", fontSize: 13 }}>Two-factor authentication is enabled.</p>
          <button className="btn secondary" onClick={disableMfa}>
            Disable two-factor authentication
          </button>
        </div>
      )}
    </div>
  );
}
