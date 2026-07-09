"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";

interface AdminUser {
  id: string;
  email: string;
  role: string;
  active: boolean;
  created_at: string;
}

export default function AdminTeamPage() {
  const { token } = useAdminAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "support">("support");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!token) return;
    const data = await api.get("/organizations/admin-users", { authToken: token });
    setUsers(data.adminUsers ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function invite() {
    if (!token || !email || password.length < 10) {
      setError("Email and a password of at least 10 characters are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/organizations/admin-users", { email, password, role }, { authToken: token });
      setEmail("");
      setPassword("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 18 }}>Team</h1>

      <div style={{ border: "1px solid #d8dee3", borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginTop: 0 }}>Invite a team member</h2>
        <div className="field">
          <label>Email</label>
          <input className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Temporary password (share securely — there's no reset-email flow yet)</label>
          <input className="text-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Role</label>
          <select
            className="text-input"
            value={role}
            onChange={(e) => setRole(e.target.value as "manager" | "support")}
          >
            <option value="support">Support — orders only, no financials</option>
            <option value="manager">Manager — orders, products, reports</option>
          </select>
        </div>
        {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}
        <button className="btn" onClick={invite} disabled={submitting}>
          {submitting ? "Inviting…" : "Invite"}
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
