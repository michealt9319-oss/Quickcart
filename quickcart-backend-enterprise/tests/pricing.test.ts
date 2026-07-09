import { calculateOrderTotals, DEFAULT_DELIVERY_FEE, DEFAULT_CONVENIENCE_FEE } from "../src/lib/pricing";
import { Organization, CartLine } from "../src/types";

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Test Org",
    slug: "test-org",
    delivery_fee: null,
    convenience_fee: null,
    currency: "NGN",
    active: true,
    ...overrides,
  };
}

const sampleItems: CartLine[] = [
  { productId: "p1", name: "Rice", price: 5000, quantity: 1 },
  { productId: "p2", name: "Milk", price: 1200, quantity: 2 },
];

describe("calculateOrderTotals", () => {
  it("uses platform defaults when the org has no fee override", () => {
    const org = makeOrg();
    const result = calculateOrderTotals(sampleItems, org);

    expect(result.subtotal).toBe(5000 + 1200 * 2);
    expect(result.deliveryFee).toBe(DEFAULT_DELIVERY_FEE);
    expect(result.serviceFee).toBe(DEFAULT_CONVENIENCE_FEE);
    expect(result.total).toBe(result.subtotal + DEFAULT_DELIVERY_FEE + DEFAULT_CONVENIENCE_FEE);
  });

  it("uses the org's fee override when set", () => {
    const org = makeOrg({ delivery_fee: "500", convenience_fee: "150" });
    const result = calculateOrderTotals(sampleItems, org);

    expect(result.deliveryFee).toBe(500);
    expect(result.serviceFee).toBe(150);
  });

  it("charges no delivery/convenience fee for an empty cart", () => {
    const org = makeOrg();
    const result = calculateOrderTotals([], org);

    expect(result.subtotal).toBe(0);
    expect(result.deliveryFee).toBe(0);
    expect(result.serviceFee).toBe(0);
    expect(result.total).toBe(0);
  });
});
