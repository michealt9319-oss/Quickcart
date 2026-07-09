"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";

interface Supermarket {
  id: string;
  name: string;
  phone: string | null;
  zone: string | null;
  active: boolean;
}

export default function AdminSupermarketsPage() {
  const { token } = useAdminAuth();
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zone, setZone] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!token) return;
    const data = await api.get("/supermarkets", { authToken: token });
    setSupermarkets(data.supermarkets ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function create() {
    if (!token || !name) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/supermarkets", { name, phone: phone || undefined, zone: zone || undefined }, { authToken: token });
      setName("");
      setPhone("");
      setZone("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(s: Supermarket) {
    if (!token) return;
    await api.put(`/supermarkets/${s.id}`, { active: !s.active }, { authToken: token });
    load();
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 18 }}>Supermarkets</h1>
      <p className="muted" style={{ fontSize: 13 }}>
        Products (in the Products tab) are assigned to one of these by ID — copy the ID after
        creating a supermarket here.
      </p>

      <div style={{ border: "1px solid #d8dee3", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>Add a supermarket</h2>
        <div className="field">
          <label>Name</label>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Phone (optional)</label>
          <input className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>Zone (optional)</label>
          <input className="text-input" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Wuse, Lekki..." />
        </div>
        {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}
        <button className="btn" onClick={create} disabled={submitting}>
          {submitting ? "Adding…" : "Add supermarket"}
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>ID (copy for products)</th>
            <th>Zone</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {supermarkets.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td style={{ fontSize: 11, fontFamily: "monospace" }}>{s.id}</td>
              <td>{s.zone ?? "—"}</td>
              <td>{s.active ? "Yes" : "No"}</td>
              <td>
                <button className="btn secondary" style={{ width: "auto", padding: "4px 10px", fontSize: 12 }} onClick={() => toggleActive(s)}>
                  {s.active ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {supermarkets.length === 0 && <p className="muted">No supermarkets yet.</p>}
    </div>
  );
}
