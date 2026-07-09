"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";
import { Pagination } from "@/components/Pagination";
import { downloadCsv } from "@/lib/csv";

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin_email: string | null;
}

const PAGE_SIZE = 50;

export default function AdminAuditLogPage() {
  const { token } = useAdminAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!token) return;
    api
      .get(`/organizations/audit-logs?page=${page}&limit=${PAGE_SIZE}`, { authToken: token })
      .then((data) => {
        setLogs(data.auditLogs ?? []);
        setTotal(data.total ?? 0);
      });
  }, [token, page]);

  function exportCsv() {
    downloadCsv(
      "audit-log.csv",
      ["When", "Who", "Action", "Entity Type", "Entity ID"],
      logs.map((l) => [new Date(l.created_at).toISOString(), l.admin_email ?? "", l.action, l.entity_type ?? "", l.entity_id ?? ""])
    );
  }

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 18 }}>Audit log</h1>
        <button className="btn secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 13 }} onClick={exportCsv}>
          Export this page (CSV)
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13 }}>
        Read-only — entries can't be edited or deleted.
      </p>

      <table className="admin-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Who</th>
            <th>Action</th>
            <th>Entity</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td style={{ whiteSpace: "nowrap" }}>{new Date(l.created_at).toLocaleString()}</td>
              <td>{l.admin_email ?? "—"}</td>
              <td>{l.action}</td>
              <td>
                {l.entity_type ? `${l.entity_type}${l.entity_id ? ` (${l.entity_id.slice(0, 8)})` : ""}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="muted">No audit entries yet.</p>}
      <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}
