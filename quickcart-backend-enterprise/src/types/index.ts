export type AdminRole = "owner" | "manager" | "support";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packing"
  | "with_rider"
  | "delivered"
  | "cancelled";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  delivery_fee: string | null;
  convenience_fee: string | null;
  currency: string;
  active: boolean;
}

export interface Product {
  id: string;
  organization_id: string;
  supermarket_id: string;
  name: string;
  price: string;
  unit: string | null;
  category: string | null;
  in_stock: boolean;
  image_url: string | null;
}

export interface CartLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  organization_id: string;
  order_number: string;
  customer_id: string;
  supermarket_id: string;
  items_json: CartLine[];
  subtotal: string;
  delivery_fee: string;
  service_fee: string;
  total: string;
  status: OrderStatus;
  payment_status: string;
  payment_reference: string | null;
  delivery_address: string;
  customer_email: string | null;
  payment_provider: string;
  created_at: string;
}
