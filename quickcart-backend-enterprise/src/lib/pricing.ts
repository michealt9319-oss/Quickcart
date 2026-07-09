import { CartLine, Organization } from "../types";

export const DEFAULT_DELIVERY_FEE = 700;
export const DEFAULT_CONVENIENCE_FEE = 300;

export const ASSUMED_RIDER_COST = 850;
export const ASSUMED_PACKAGING_COST = 300;
export const ASSUMED_PAYMENT_FEE_RATE = 0.015;

// Each organization can override the platform default delivery/convenience
// fee (see organizations.delivery_fee / convenience_fee) — a multi-city or
// multi-tenant deployment won't always want the same fees everywhere.
// Falls back to the platform default when an org hasn't set its own.
export function calculateOrderTotals(items: CartLine[], org: Organization) {
  const deliveryFee = org.delivery_fee !== null ? Number(org.delivery_fee) : DEFAULT_DELIVERY_FEE;
  const convenienceFee = org.convenience_fee !== null ? Number(org.convenience_fee) : DEFAULT_CONVENIENCE_FEE;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const appliedDeliveryFee = subtotal > 0 ? deliveryFee : 0;
  const appliedServiceFee = subtotal > 0 ? convenienceFee : 0;
  const total = subtotal + appliedDeliveryFee + appliedServiceFee;

  return { subtotal, deliveryFee: appliedDeliveryFee, serviceFee: appliedServiceFee, total };
}

export function generateOrderNumber(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `QC${Date.now().toString().slice(-6)}${rand}`;
}
