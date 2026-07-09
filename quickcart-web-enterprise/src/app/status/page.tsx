"use client";

import { useState } from "react";
import { Order } from "@/types";
import { formatNaira } from "@/lib/pricing";
import { api } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  confirmed: "Confirmed",
  packing: "Being packed",
  with_rider: "With your rider",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function StatusLookupPage() {
  const [phone, setPhone] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const params = new URLSearchParams({ phone, orderNumber });
      const data = await api.get(`/orders/lookup?${params.toString()}`);
      setOrder(data.order);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: 18 }}>Check your order status</h1>

      <div className="field">
        <label>Phone number used at checkout</label>
        <input className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <div className="field">
        <label>Order number</label>
        <input
          className="text-input"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="QC..."
        />
      </div>

      <button className="btn" onClick={lookup} disabled={loading}>
        {loading ? "Checking…" : "Check status"}
      </button>

      {error && <p style={{ color: "#a32d2d", fontSize: 13, marginTop: 12 }}>{error}</p>}

      {order && (
        <div style={{ marginTop: 20 }}>
          <div className="row">
            <span className="muted">Status</span>
            <span className="status-badge">{STATUS_LABELS[order.status] ?? order.status}</span>
          </div>
          <div className="row" style={{ borderBottom: "none" }}>
            <span className="muted">Total</span>
            <span>{formatNaira(Number(order.total))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
