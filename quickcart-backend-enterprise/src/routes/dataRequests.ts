import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { recordAudit } from "../middleware/audit";

export const dataRequestsRouter = Router();

/// Deliberately admin-triggered, not a public self-service endpoint keyed
/// only by phone number. There's no customer login in this system — a
/// public "export/delete my data, just tell me the phone number" endpoint
/// would let anyone export or delete ANYONE's order history by guessing or
/// knowing their number. The realistic flow for a WhatsApp-first business
/// is: a customer messages asking for their data, an admin verifies who
/// they're talking to via the same channel, then runs this. If you later
/// add real customer accounts with their own login, revisit this to be
/// customer-self-service instead.

const phoneParamSchema = z.object({ phone: z.string().min(7) });

dataRequestsRouter.get(
  "/export",
  requireAuth,
  requireRole("owner", "manager"),
  asyncHandler(async (req, res) => {
    const parsed = phoneParamSchema.safeParse({ phone: req.query.phone });
    if (!parsed.success) {
      return res.status(400).json({ error: "phone query parameter is required" });
    }
    const { phone } = parsed.data;
    const { organizationId } = req.admin!;

    const customers = await query(
      `SELECT id, phone, name, default_address, created_at FROM customers
       WHERE phone = $1 AND organization_id = $2`,
      [phone, organizationId]
    );
    if (customers.length === 0) {
      return res.status(404).json({ error: "No customer found with this phone number" });
    }

    const orders = await query(
      `SELECT order_number, items_json, subtotal, delivery_fee, service_fee, total,
              status, payment_status, delivery_address, customer_email, created_at
       FROM orders WHERE customer_id = $1`,
      [customers[0].id]
    );

    const deviceTokens = await query(
      `SELECT platform, created_at FROM device_tokens WHERE organization_id = $1 AND phone = $2`,
      [organizationId, phone]
    );

    // Everything this system holds that's tied to this phone number,
    // structured as a single downloadable JSON document — the standard
    // shape for a data-subject access request.
    res.json({
      customer: customers[0],
      orders,
      registeredDevices: deviceTokens,
      exportedAt: new Date().toISOString(),
    });
  })
);

const deleteSchema = z.object({ phone: z.string().min(7) });

dataRequestsRouter.post(
  "/delete",
  requireAuth,
  requireRole("owner"),
  validateBody(deleteSchema),
  asyncHandler(async (req, res) => {
    const { phone } = req.body as z.infer<typeof deleteSchema>;
    const { organizationId, adminUserId } = req.admin!;

    const customers = await query<{ id: string }>(
      `SELECT id FROM customers WHERE phone = $1 AND organization_id = $2`,
      [phone, organizationId]
    );
    if (customers.length === 0) {
      return res.status(404).json({ error: "No customer found with this phone number" });
    }
    const customerId = customers[0].id;

    // Anonymize rather than hard-delete order rows: orders are financial
    // records (revenue reporting, tax, dispute history) that generally
    // need to be RETAINED even after a personal-data deletion request —
    // this is standard practice under GDPR/NDPR, which allow retaining
    // data where there's a legal basis (e.g. accounting obligations) even
    // after an erasure request for the personal-data PORTION of it. What
    // actually gets removed: the customer's phone/name/address, and their
    // device tokens (no legitimate reason to retain those after deletion).
    await query(
      `UPDATE customers SET phone = 'deleted-' || id, name = NULL, default_address = NULL WHERE id = $1`,
      [customerId]
    );
    await query(`UPDATE orders SET customer_email = NULL, delivery_address = '[deleted]' WHERE customer_id = $1`, [
      customerId,
    ]);
    await query(`DELETE FROM device_tokens WHERE organization_id = $1 AND phone = $2`, [organizationId, phone]);

    await recordAudit({
      organizationId,
      adminUserId,
      action: "customer.data_deleted",
      entityType: "customer",
      entityId: customerId,
    });

    res.json({ ok: true, note: "Personal data anonymized. Order financial records retained for accounting purposes." });
  })
);
