"use client";

import { useEffect, useState } from "react";
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

const CANCELLABLE_STATUSES = ["pending", "confirmed", "packing"];

interface OrderSummary {
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
}

export default function OrderConfirmationPage({ params }: { params: { id: string } }) {
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [phone, setPhone] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  function loadOrder() {
    api
      .get(`/orders/${params.id}`)
      .then((data) => setOrder(data.order ?? null))
      .catch(() => setOrder(null));
  }

  useEffect(loadOrder, [params.id]);

  async function cancelOrder() {
    if (!phone) {
      setCancelError("Enter the phone number you used at checkout.");
      return;
    }
    setCancelling(true);
    setCancelError("");
    try {
      await api.post(`/orders/${params.id}/cancel`, { phone });
      setShowCancelForm(false);
      loadOrder();
    } catch (err: any) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  const canCancel = order && CANCELLABLE_STATUSES.includes(order.status);

  return (
    <div className="container">
      <h1 style={{ fontSize: 18 }}>Thank you!</h1>
      <p className="muted">
        Your order has been placed. We've sent a confirmation to your WhatsApp — reply there any time
        with questions about your delivery.
      </p>

      {order ? (
        <>
          <div className="row" style={{ marginTop: 16 }}>
            <span className="muted">Order number</span>
            <span>{order.order_number}</span>
          </div>
          <div className="row">
            <span className="muted">Status</span>
            <span className="status-badge">{STATUS_LABELS[order.status] ?? order.status}</span>
          </div>
          <div className="row" style={{ borderBottom: "none" }}>
            <span className="muted">Total paid</span>
            <span>{formatNaira(Number(order.total))}</span>
          </div>

          {canCancel && !showCancelForm && (
            <button
              className="btn secondary"
              style={{ marginTop: 16 }}
              onClick={() => setShowCancelForm(true)}
            >
              Cancel this order
            </button>
          )}

          {canCancel && showCancelForm && (
            <div style={{ marginTop: 16, border: "1px solid #d8dee3", borderRadius: 8, padding: 16 }}>
              <p style={{ marginTop: 0, fontSize: 13 }}>
                Confirm the phone number you used at checkout to cancel this order.
              </p>
              <div className="field">
                <input
                  className="text-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="080X XXX XXXX"
                />
              </div>
              {cancelError && <p style={{ color: "#a32d2d", fontSize: 13 }}>{cancelError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={cancelOrder} disabled={cancelling}>
                  {cancelling ? "Cancelling…" : "Confirm cancellation"}
                </button>
                <button className="btn secondary" onClick={() => setShowCancelForm(false)}>
                  Never mind
                </button>
              </div>
            </div>
          )}

          {order.status === "with_rider" && (
            <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
              This order is already with a rider and can no longer be cancelled here — contact us
              via WhatsApp if there's a problem.
            </p>
          )}
        </>
      ) : (
        <p className="muted">Loading your order…</p>
      )}

      <p className="muted" style={{ marginTop: 24 }}>
        You can check your delivery status any time on the{" "}
        <a href="/status">order status page</a> using your phone number and order number.
      </p>
    </div>
  );
}
