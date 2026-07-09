import { calculateOrderTotals, formatNaira, generateOrderNumber, DELIVERY_FEE, CONVENIENCE_FEE } from "../pricing";
import { CartLine } from "@/types";

const sampleItems: CartLine[] = [
  { productId: "p1", name: "Rice", price: 5000, quantity: 1 },
  { productId: "p2", name: "Milk", price: 1200, quantity: 2 },
];

describe("calculateOrderTotals", () => {
  it("sums line items and adds delivery + convenience fee for a non-empty cart", () => {
    const result = calculateOrderTotals(sampleItems);
    expect(result.subtotal).toBe(5000 + 1200 * 2);
    expect(result.deliveryFee).toBe(DELIVERY_FEE);
    expect(result.serviceFee).toBe(CONVENIENCE_FEE);
    expect(result.total).toBe(result.subtotal + DELIVERY_FEE + CONVENIENCE_FEE);
  });

  it("charges no fees for an empty cart", () => {
    const result = calculateOrderTotals([]);
    expect(result.subtotal).toBe(0);
    expect(result.deliveryFee).toBe(0);
    expect(result.serviceFee).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("formatNaira", () => {
  it("formats a whole number amount with the naira symbol and thousands separators", () => {
    expect(formatNaira(10750)).toBe("\u20a610,750");
  });

  it("formats zero correctly", () => {
    expect(formatNaira(0)).toBe("\u20a60");
  });
});

describe("generateOrderNumber", () => {
  it("always starts with QC and produces different values on each call", () => {
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a.startsWith("QC")).toBe(true);
    expect(a).not.toBe(b);
  });
});
