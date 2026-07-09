"use client";

import { useEffect, useState } from "react";
import { Order, OrderStatus } from "@/types";
import { formatNaira } from "@/lib/pricing";
import { api } from "@/lib/api";
import { useAdminAuth } from "@/lib/adminAuth";
import { Pagination } from "@/components/Pagination";
import { downloadCsv } from "@/lib/csv";

const STATUSES: OrderStatus[] = ["pending", "confirmed", "packing", "with_rider", "delivered", "cancelled"];
const PAGE_SIZE = 25;

export default function AdminOrdersPage() {
  const { token, role } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundError, setRefundError] = useState("");

  async function loadOrders() {
    if (!token) return;
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (filter) params.set("status", filter);
    const data = await api.get(`/admin/orders?${params.toString()}`, { authToken: token });
    setOrders(data.orders ?? []);
    setTotal(data.total ?? 0);
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, token]);

  // Reset to page 1 whenever the filter changes — staying on page 3 of a
  // now-different result set would silently show the wrong orders.
  function changeFilter(next: string) {
    setFilter(next);
    setPage(1);
  }

  async function updateStatus(orderId: string, status: string) {
    if (!token) return;
    await api.put(`/admin/orders/${orderId}/status`, { status }, { authToken: token });
    loadOrders();
  }

  async function refund(order: Order) {
    if (!token) return;
    const confirmed = window.confirm(
      `Refund order ${order.order_number} for ${formatNaira(Number(order.total))}? This calls Paystack's refund API and cannot be undone from here.`
    );
    if (!confirmed) return;

    setRefundingId(order.id);
    setRefundError("");
    try {
      await api.post(`/admin/orders/${order.id}/refund`, {}, { authToken: token });
      await loadOrders();
    } catch (err: any) {
      setRefundError(`Could not refund ${order.order_number}: ${err.message}`);
    } finally {
      setRefundingId(null);
    }
  }

  function exportCsv() {
    downloadCsv(
      "orders.csv",
      ["Order Number", "Total", "Payment Status", "Status", "Created At"],
      orders.map((o) => [o.order_number, o.total, o.payment_status, o.status, o.created_at])
    );
  }

  // Refunds move real money — restrict the button to owner/manager here too,
  // matching the backend's requireRole("owner", "manager") on that route.
  // The backend enforces this regardless; hiding the button for support
  // accounts just avoids a confusing 403 for a role that was never going
  // to be allowed to do this.
  const canRefund = role === "owner" || role === "manager";

  return (
    <div className="container" style={{ maxWidth: 960 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 18 }}>Order queue</h1>
        <button className="btn secondary" style={{ width: "auto", padding: "6px 12px", fontSize: 13 }} onClick={exportCsv}>
          Export this page (CSV)
        </button>
      </div>

      <div className="chip-row">
        <div className={`chip ${filter === "" ? "active" : ""}`} onClick={() => changeFilter("")}>
          All
        </div>
        {STATUSES.map((s) => (
          <div key={s} className={`chip ${filter === s ? "active" : ""}`} onClick={() => changeFilter(s)}>
            {s}
          </div>
        ))}
      </div>

      {refundError && <p style={{ color: "#a32d2d", fontSize: 13, marginTop: 8 }}>{refundError}</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Order #</th>
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Update</th>
            {canRefund && <th>Refund</th>}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.order_number}</td>
              <td>{formatNaira(Number(o.total))}</td>
              <td>{o.payment_status}</td>
              <td>{o.status}</td>
              <td>
                <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
              {canRefund && (
                <td>
                  {o.payment_status === "paid" ? (
                    <button
                      className="btn secondary"
                      style={{ width: "auto", padding: "4px 10px", fontSize: 12 }}
                      disabled={refundingId === o.id}
                      onClick={() => refund(o)}
                    >
                      {refundingId === o.id ? "Refunding…" : "Refund"}
                    </button>
                  ) : (
                    <span className="muted" style={{ fontSize: 12 }}>
                      —
                    </span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {orders.length === 0 && <p className="muted">No orders yet.</p>}
      <Pagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
    </div>
  );
}
