export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packing"
  | "with_rider"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface Product {
  id: string;
  supermarket_id: string;
  name: string;
  price: number;
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

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  supermarket_id: string;
  items_json: CartLine[];
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  delivery_address: string;
  created_at: string;
}
