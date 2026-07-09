import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { recordAudit } from "../middleware/audit";
import { notifyOrderStatus } from "../lib/whatsapp";
import { sendPushToPhone } from "../lib/push";
import { refundTransaction as refundViaPaystack } from "../lib/paystack";
import * as flutterwave from "../lib/flutterwave";
import { Order } from "../types";

export const adminOrdersRouter = Router();

// owner, manager, and support can all view/update orders — support is the
// day-to-day ops role, not just a read-only one. Reports (financials) are
// separately restricted to owner/manager — see routes/reports.ts.
adminOrdersRouter.get(
  "/",
  requireAuth,
  requireRole("owner", "manager", "support"),
  asyncHandler(async (req, res) => {
    const { organizationId } = req.admin!;
    const status = req.query.status as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions = status ? `organization_id = $1 AND status = $2` : `organization_id = $1`;
    const baseParams = status ? [organizationId, status] : [organizationId];

    const [countRow] = await query<{ count: string }>(
      `SELECT COUNT(*) FROM orders WHERE ${conditions}`,
      baseParams
    );
    const orders = await query<Order>(
      `SELECT * FROM orders WHERE ${conditions} ORDER BY created_at DESC LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
      [...baseParams, limit, offset]
    );

    res.json({ orders, page, limit, total: Number(countRow.count) });
  })
);

const VALID_STATUSES = ["pending", "confirmed", "packing", "with_rider", "delivered", "cancelled"];
const statusSchema = z.object({ status: z.enum(VALID_STATUSES as [string, ...string[]]) });

adminOrdersRouter.put(
  "/:id/status",
  requireAuth,
  requireRole("owner", "manager", "support"),
  validateBody(statusSchema),
  asyncHandler(async (req, res) => {
    const { organizationId, adminUserId } = req.admin!;
    const { status } = req.body as z.infer<typeof statusSchema>;

    const updated = await query<{ order_number: string; customer_id: string }>(
      `UPDATE orders SET status = $1, updated_at = now()
       WHERE id = $2 AND organization_id = $3
       RETURNING order_number, customer_id`,
      [status, req.params.id, organizationId]
    );

    if (updated.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    await recordAudit({
      organizationId,
      adminUserId,
      action: "order.status_changed",
      entityType: "order",
      entityId: req.params.id,
      metadata: { newStatus: status },
    });

    const customers = await query<{ phone: string }>(`SELECT phone FROM customers WHERE id = $1`, [
      updated[0].customer_id,
    ]);
    if (customers.length > 0) {
      const statusLabels: Record<string, string> = {
        packing: "is being packed",
        with_rider: "is on its way",
        delivered: "has been delivered",
      };
      await notifyOrderStatus({ customerPhone: customers[0].phone, orderNumber: updated[0].order_number, status });
      if (statusLabels[status]) {
        await sendPushToPhone({
          organizationId,
          phone: customers[0].phone,
          title: "Order update",
          body: `Your QuickCart order ${updated[0].order_number} ${statusLabels[status]}.`,
        });
      }
    }

    res.json({ ok: true });
  })
);

// owner/manager only — refunds move real money, support shouldn't trigger them.
adminOrdersRouter.post(
  "/:id/refund",
  requireAuth,
  requireRole("owner", "manager"),
  asyncHandler(async (req, res) => {
    const { organizationId, adminUserId } = req.admin!;

    const orders = await query<Order>(
      `SELECT * FROM orders WHERE id = $1 AND organization_id = $2`,
      [req.params.id, organizationId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const order = orders[0];
    if (order.payment_status !== "paid") {
      return res.status(400).json({ error: `Cannot refund an order with payment status '${order.payment_status}'` });
    }
    if (!order.payment_reference) {
      return res.status(400).json({ error: "Order has no payment reference to refund against" });
    }

    // Actually calls the real payment provider's refund API — this is real
    // money movement, not just a status flag. If the provider rejects it
    // (already refunded, outside refund window, etc.), that error
    // propagates to the caller rather than being silently marked as
    // refunded anyway.
    if (order.payment_provider === "flutterwave") {
      const transactionId = await flutterwave.findTransactionIdByReference(order.payment_reference);
      await flutterwave.refundTransaction({ flutterwaveTransactionId: transactionId });
    } else {
      await refundViaPaystack({ reference: order.payment_reference });
    }

    await query(`UPDATE orders SET payment_status = 'refunded', status = 'cancelled', updated_at = now() WHERE id = $1`, [
      order.id,
    ]);

    await recordAudit({
      organizationId,
      adminUserId,
      action: "order.refunded",
      entityType: "order",
      entityId: order.id,
      metadata: { amount: order.total },
    });

    res.json({ ok: true });
  })
);
