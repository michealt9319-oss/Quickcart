"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CartLine } from "@/types";
import { getCart, updateQuantity } from "@/lib/cart";
import { calculateOrderTotals, formatNaira } from "@/lib/pricing";

export default function CartPage() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const router = useRouter();

  useEffect(() => {
    setCart(getCart());
  }, []);

  const { subtotal, deliveryFee, serviceFee, total } = calculateOrderTotals(cart);

  return (
    <div className="container">
      <h1 style={{ fontSize: 18 }}>Your cart</h1>

      {cart.length === 0 && <p className="muted">Your cart is empty. Go back and add something you need.</p>}

      {cart.map((line) => (
        <div className="row" key={line.productId}>
          <div>
            <p style={{ margin: 0 }}>{line.name}</p>
            <p className="muted" style={{ margin: 0 }}>{formatNaira(line.price)} each</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="btn secondary"
              style={{ width: 32, padding: 6 }}
              onClick={() => setCart(updateQuantity(line.productId, line.quantity - 1))}
            >
              −
            </button>
            <span>{line.quantity}</span>
            <button
              className="btn secondary"
              style={{ width: 32, padding: 6 }}
              onClick={() => setCart(updateQuantity(line.productId, line.quantity + 1))}
            >
              +
            </button>
          </div>
        </div>
      ))}

      {cart.length > 0 && (
        <>
          <div className="row">
            <span className="muted">Subtotal</span>
            <span>{formatNaira(subtotal)}</span>
          </div>
          <div className="row">
            <span className="muted">Delivery fee</span>
            <span>{formatNaira(deliveryFee)}</span>
          </div>
          <div className="row">
            <span className="muted">Convenience fee</span>
            <span>{formatNaira(serviceFee)}</span>
          </div>
          <div className="row" style={{ fontWeight: 700, borderBottom: "none" }}>
            <span>Total</span>
            <span>{formatNaira(total)}</span>
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => router.push("/checkout")}>
              Go to checkout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
