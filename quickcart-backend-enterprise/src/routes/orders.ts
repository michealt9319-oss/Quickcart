import { Router } from "express";
import { z } from "zod";
import { query, withTransaction } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { resolveOrganizationFromHeader } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { calculateOrderTotals, generateOrderNumber } from "../lib/pricing";
import { CartLine, Order } from "../types";
import { incrementMetric } from "../lib/metrics";

export const ordersRouter = Router();

const createOrderSchema = z.object({
  customerPhone: z.string().min(7),
  customerName: z.string().optional().default(""),
  address: z.string().min(3),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() }))
    .min(1),
});

type OrderTransactionResult =
  | { orderId: string; orderNumber: string; total: number }
  | { ok: true }
  | { error: { status: number; body: Record<string, unknown> } };

ordersRouter.post(
  "/",
  resolveOrganizationFromHeader,
  validateBody(createOrderSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createOrderSchema>;
    const org = req.organization!;

    const result = await withTransaction<OrderTransactionResult>(async (client) => {
      const productIds = body.items.map((i) => i.productId);
      // FOR UPDATE locks these rows for the duration of the transaction —
      // two simultaneous checkouts for the last unit of the same product
      // can't both read "1 in stock" and both succeed; the second one
      // waits for the first transaction to commit (or roll back) before
      // it can even read the row.
      const productsResult = await client.query(
        `SELECT id, name, price, supermarket_id, stock_quantity FROM products
         WHERE id = ANY($1::uuid[]) AND organization_id = $2 AND in_stock = true
         FOR UPDATE`,
        [productIds, org.id]
      );
      const products = productsResult.rows as {
        id: string;
        name: string;
        price: string;
        supermarket_id: string;
        stock_quantity: number;
      }[];

      if (products.length !== productIds.length) {
        const foundIds = new Set(products.map((p) => p.id));
        const missingIds = productIds.filter((id) => !foundIds.has(id));
        return {
          error: {
            status: 400,
            body: {
              error: "One or more items in your cart are no longer available. Please review your cart and try again.",
              unavailableProductIds: missingIds,
            },
          },
        };
      }

      // Check quantity availability before touching anything — a partial
      // decrement followed by an error is exactly what the transaction
      // wrapper exists to prevent, but checking up front avoids relying on
      // rollback for the common case too.
      const insufficientStock = body.items.filter((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        return product.stock_quantity < item.quantity;
      });
      if (insufficientStock.length > 0) {
        return {
          error: {
            status: 400,
            body: {
              error: "Not enough stock for one or more items in your cart.",
              insufficientStockProductIds: insufficientStock.map((i) => i.productId),
            },
          },
        };
      }

      const lines: CartLine[] = body.items.map((item) => {
        const product = products.find((p) => p.id === item.productId)!;
        return { productId: product.id, name: product.name, price: Number(product.price), quantity: item.quantity };
      });

      for (const item of body.items) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity - $1,
                                in_stock = (stock_quantity - $1) > 0
           WHERE id = $2`,
          [item.quantity, item.productId]
        );
      }

      const { subtotal, deliveryFee, serviceFee, total } = calculateOrderTotals(lines, org);
      const supermarketId = products[0].supermarket_id;
      const orderNumber = generateOrderNumber();

      const customerResult = await client.query(
        `INSERT INTO customers (organization_id, phone, name, default_address)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (organization_id, phone) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [org.id, body.customerPhone, body.customerName, body.address]
      );
      const customerId = customerResult.rows[0].id;

      const orderResult = await client.query(
        `INSERT INTO orders
           (organization_id, order_number, customer_id, supermarket_id, items_json,
            subtotal, delivery_fee, service_fee, total, delivery_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, order_number`,
        [
          org.id,
          orderNumber,
          customerId,
          supermarketId,
          JSON.stringify(lines),
          subtotal,
          deliveryFee,
          serviceFee,
          total,
          body.address,
        ]
      );

      return { orderId: orderResult.rows[0].id, orderNumber: orderResult.rows[0].order_number, total };
    });

    if ("error" in result) {
      return res.status(result.error.status).json(result.error.body);
    }
    if (!("orderId" in result)) {
      return res.status(500).json({ error: "Unexpected order creation result" });
    }

    incrementMetric("orders_created_total");
    res.status(201).json({ orderId: result.orderId, orderNumber: result.orderNumber, total: result.total });
  })
);

// "My orders" for a customer with no account — matched by phone number
// alone, same trust model as /lookup (whoever has the phone number can see
// its order history; there's no password on it). Fine for a WhatsApp-first
// business where the phone number itself is the identity; reconsider if
// you add real customer accounts later.
ordersRouter.get(
  "/history",
  resolveOrganizationFromHeader,
  asyncHandler(async (req, res) => {
    const { phone } = req.query as { phone?: string };
    if (!phone) {
      return res.status(400).json({ error: "phone is required" });
    }
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const orders = await query<Order>(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.total, o.created_at
       FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE c.phone = $1 AND o.organization_id = $2
       ORDER BY o.created_at DESC LIMIT $3`,
      [phone, req.organization!.id, limit]
    );
    res.json({ orders });
  })
);

ordersRouter.get(
  "/lookup",
  resolveOrganizationFromHeader,
  asyncHandler(async (req, res) => {
    const { phone, orderNumber } = req.query as { phone?: string; orderNumber?: string };
    if (!phone || !orderNumber) {
      return res.status(400).json({ error: "phone and orderNumber are required" });
    }

    const orders = await query<Order>(
      `SELECT o.* FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE c.phone = $1 AND o.order_number = $2 AND o.organization_id = $3`,
      [phone, orderNumber, req.organization!.id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: "No matching order found" });
    }
    res.json({ order: orders[0] });
  })
);

ordersRouter.get(
  "/:id",
  resolveOrganizationFromHeader,
  asyncHandler(async (req, res) => {
    const orders = await query<Order>(
      `SELECT id, order_number, status, payment_status, total, created_at
       FROM orders WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.organization!.id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json({ order: orders[0] });
  })
);

const cancelSchema = z.object({ phone: z.string().min(7) });

// Customer-initiated cancellation — no admin involved. Guarded two ways:
// the phone number must match the order (same trust model as lookup/
// history above — there's no password, the phone number IS the identity),
// and the order must still be in a cancellable state. Once a rider has it,
// cancellation needs a human (call the rider, sort out the handoff) —
// that's not something an API endpoint should silently allow.
const CANCELLABLE_STATUSES = ["pending", "confirmed", "packing"];

ordersRouter.post(
  "/:id/cancel",
  resolveOrganizationFromHeader,
  validateBody(cancelSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body as z.infer<typeof cancelSchema>;

    const result = await withTransaction<OrderTransactionResult>(async (client) => {
      const orders = await client.query(
        `SELECT o.id, o.status, o.items_json, o.customer_id, c.phone
         FROM orders o JOIN customers c ON c.id = o.customer_id
         WHERE o.id = $1 AND o.organization_id = $2
         FOR UPDATE`,
        [req.params.id, req.organization!.id]
      );

      if (orders.rows.length === 0) {
        return { error: { status: 404, body: { error: "Order not found" } } };
      }
      const order = orders.rows[0];

      if (order.phone !== phone) {
        // Same error whether the order doesn't exist or the phone doesn't
        // match — don't confirm to a caller that an order ID is real if
        // they don't also know the phone number on it.
        return { error: { status: 404, body: { error: "Order not found" } } };
      }

      if (!CANCELLABLE_STATUSES.includes(order.status)) {
        return {
          error: {
            status: 400,
            body: { error: `This order can no longer be cancelled (current status: ${order.status}). Contact support.` },
          },
        };
      }

      // Restore stock for every line item — the inverse of the decrement
      // at order creation. in_stock is derived from the resulting quantity
      // rather than forced to true, so this can't accidentally undo an
      // admin's separate decision to discontinue a product. It's still not
      // perfect: if an admin discontinued a product for a reason unrelated
      // to stock count (e.g. quality issue) while quantity was still > 0,
      // a cancellation restore could re-list it — a real edge case, not
      // fully closed here.
      const items = order.items_json as CartLine[];
      for (const item of items) {
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity + $1,
               in_stock = (stock_quantity + $1) > 0
           WHERE id = $2`,
          [item.quantity, item.productId]
        );
      }

      await client.query(`UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1`, [order.id]);

      return { ok: true };
    });

    if ("error" in result) {
      return res.status(result.error.status).json(result.error.body);
    }
    res.json({ ok: true });
  })
);
