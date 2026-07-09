"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";

export default function DataRequestsPage() {
  const { token } = useAdminAuth();
  const [phone, setPhone] = useState("");
  const [exported, setExported] = useState<any | null>(null);
  const [message, setMessage] = useState("");

  async function doExport() {
    if (!token) return;
    try {
      const data = await api.get(`/data-requests/export?phone=${encodeURIComponent(phone)}`, { authToken: token });
      setExported(data);
      setMessage("");
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  async function doDelete() {
    if (!token) return;
    try {
      await api.post("/data-requests/delete", { phone }, { authToken: token });
      setExported(null);
      setMessage("Personal data anonymized (orders retained for accounting).");
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 18 }}>Data requests (export / delete)</h1>
      <div style={{ border: "1px solid #d8dee3", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <div className="field">
          <label>Phone</label>
          <input className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803..." />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={doExport} disabled={!phone}>
            Export
          </button>
          <button className="btn secondary" onClick={doDelete} disabled={!phone}>
            Delete (anonymize)
          </button>
        </div>
        {message && <p style={{ color: "#a32d2d", marginTop: 12 }}>{message}</p>}
      </div>

      {exported && (
        <div style={{ whiteSpace: "pre-wrap", background: "#f6f8f9", padding: 12, borderRadius: 6 }}>
          <h3>Exported data</h3>
          <pre style={{ maxHeight: 400, overflow: "auto" }}>{JSON.stringify(exported, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
