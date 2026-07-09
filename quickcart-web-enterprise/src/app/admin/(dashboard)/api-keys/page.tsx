"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";

export default function ApiKeysPage() {
  const { token } = useAdminAuth();
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    if (!token) return;
    try {
      const data = await api.get("/api-keys", { authToken: token });
      setKeys(data.apiKeys ?? []);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createKey() {
    if (!token) return;
    try {
      const data = await api.post("/api-keys", { name }, { authToken: token });
      // server returns raw key only once
      setNewKey(data.key ?? null);
      setName("");
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function revoke(id: string) {
    if (!token) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/api-keys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 18 }}>API Keys</h1>
      <div style={{ border: "1px solid #d8dee3", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>Create API key</h2>
        <div className="field">
          <label>Name</label>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {error && <p style={{ color: "#a32d2d" }}>{error}</p>}
        <button className="btn" onClick={createKey} disabled={!name}>
          Create
        </button>
        {newKey && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13 }}>Key (copy now, it will not be shown again):</p>
            <pre style={{ background: "#f6f8f9", padding: 8 }}>{newKey}</pre>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 14 }}>Existing keys</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Prefix</th>
            <th>Revoked</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id}>
              <td>{k.name}</td>
              <td>{k.key_prefix}</td>
              <td>{k.revoked_at ? "Yes" : "No"}</td>
              <td>
                {!k.revoked_at && (
                  <button className="btn secondary" onClick={() => revoke(k.id)}>
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
