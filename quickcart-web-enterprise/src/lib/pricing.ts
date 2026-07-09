import { CartLine } from "@/types";

// This mirrors the pricing rules in quickcart-backend/src/lib/pricing.ts,
// used here only to show the customer a live total in the cart and
// checkout UI before they submit the order. The backend recalculates from
// scratch server-side and is the only source that actually matters for
// what gets charged — if you change these numbers, change them in both
// places, or better, have the cart page fetch a price preview from the
// backend instead of duplicating the constants. Fine to leave duplicated
// at this volume; revisit if the two ever drift.
export const DELIVERY_FEE = 700;
export const CONVENIENCE_FEE = 300;

export function calculateOrderTotals(items: CartLine[]) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal > 0 ? DELIVERY_FEE : 0;
  const serviceFee = subtotal > 0 ? CONVENIENCE_FEE : 0;
  const total = subtotal + deliveryFee + serviceFee;
  return { subtotal, deliveryFee, serviceFee, total };
}

export function formatNaira(amount: number): string {
  return `\u20a6${amount.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export function generateOrderNumber(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `QC${Date.now().toString().slice(-6)}${rand}`;
}
