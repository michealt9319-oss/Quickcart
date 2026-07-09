"use client";

import { useEffect, useState } from "react";
import { CartLine } from "@/types";
import { getCart, clearCart } from "@/lib/cart";
import { calculateOrderTotals, formatNaira } from "@/lib/pricing";
import { api } from "@/lib/api";

export default function CheckoutPage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCart(getCart());
  }, []);

  const { total } = calculateOrderTotals(cart);

  async function placeOrder() {
    if (!phone || !address || cart.length === 0) {
      setError("Please fill in your phone number and delivery address.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const orderData = await api.post("/orders", {
        customerPhone: phone,
        customerName: name,
        address,
        items: cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
      });

      const paymentData = await api.post("/payments/initialize", {
        orderId: orderData.orderId,
        email: email || undefined,
      });

      clearCart();
      window.location.href = paymentData.authorizationUrl;
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: 18 }}>Checkout</h1>

      <div className="field">
        <label>Full name</label>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>

      <div className="field">
        <label>Phone number</label>
        <input
          className="text-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="080X XXX XXXX"
        />
      </div>

      <div className="field">
        <label>Email (for payment receipt)</label>
        <input className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
      </div>

      <div className="field">
        <label>Delivery address</label>
        <input
          className="text-input"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street, area, city"
        />
      </div>

      {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}

      <p className="muted" style={{ marginBottom: 12 }}>
        You'll be redirected to Paystack to complete payment securely. Your order is only
        confirmed once payment succeeds.
      </p>

      <button className="btn" onClick={placeOrder} disabled={submitting}>
        {submitting ? "Placing order…" : `Place order — ${formatNaira(total)}`}
      </button>
    </div>
  );
}
