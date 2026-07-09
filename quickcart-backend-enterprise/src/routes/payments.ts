import { Router } from "express";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { resolveOrganizationFromHeader } from "../middleware/tenant";
import * as paystack from "../lib/paystack";
import * as flutterwave from "../lib/flutterwave";
import { notifyOrderStatus } from "../lib/whatsapp";
import { sendPushToPhone } from "../lib/push";
import { sendEmail } from "../lib/email";
import { alertOps } from "../lib/alerting";
import { incrementMetric } from "../lib/metrics";
import { Order } from "../types";

export const paymentsRouter = Router();

// Paystack is primary by default. Set PAYMENT_PRIMARY_PROVIDER=flutterwave
// to flip that. Either way, if the primary provider's initialize call
// throws (an outage, a misconfigured key, a transient network error) and
// the OTHER provider is configured, we fall back to it automatically
// rather than showing the customer a failed checkout — a real payment
// provider outage is exactly when this matters most, not a hypothetical.
paymentsRouter.post(
  "/initialize",
  resolveOrganizationFromHeader,
  asyncHandler(async (req, res) => {
    const { orderId, email } = req.body as { orderId: string; email?: string };

    const orders = await query<Order>(`SELECT * FROM orders WHERE id = $1 AND organization_id = $2`, [
      orderId,
      req.organization!.id,
    ]);
    if (orders.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }
    const order = orders[0];
    const callbackUrl = `${process.env.WEB_APP_URL}/order/${order.id}`;
    const initParams = {
      email: email || "guest@quickcart.ng",
      amountNaira: Number(order.total),
      reference: order.order_number,
      callbackUrl,
      currency: req.organization!.currency,
    };

    const primaryIsFlutterwave = process.env.PAYMENT_PRIMARY_PROVIDER === "flutterwave";
    const primary = primaryIsFlutterwave ? flutterwave : paystack;
    const fallback = primaryIsFlutterwave ? paystack : flutterwave;
    const primaryName = primaryIsFlutterwave ? "flutterwave" : "paystack";
    const fallbackName = primaryIsFlutterwave ? "paystack" : "flutterwave";

    let result: { authorizationUrl: string; reference: string };
    let providerUsed: string;

    try {
      result = await primary.initializeTransaction(initParams);
      providerUsed = primaryName;
    } catch (primaryErr) {
      if (!fallback.isConfigured()) {
        throw primaryErr; // no fallback available — surface the original error
      }
      console.warn(`Primary payment provider (${primaryName}) failed, falling back to ${fallbackName}:`, primaryErr);
      result = await fallback.initializeTransaction(initParams);
      providerUsed = fallbackName;
    }

    // Store the real email (not the "guest@..." placeholder) so a receipt
    // can be sent on confirmation, and which provider was used so the
    // webhook and refund routes know which one to ask.
    await query(
      `UPDATE orders SET payment_reference = $1, customer_email = $2, payment_provider = $3, updated_at = now() WHERE id = $4`,
      [result.reference, email || null, providerUsed, order.id]
    );

    res.json({ authorizationUrl: result.authorizationUrl, reference: result.reference, provider: providerUsed });
  })
);

function renderReceiptHtml(params: {
  orderNumber: string;
  items: { name: string; price: number; quantity: number }[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
}): string {
  const rows = params.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${(i.price * i.quantity).toLocaleString()}</td></tr>`
    )
    .join("");
  return `
    <h2>Order ${params.orderNumber} confirmed</h2>
    <p>Thank you for your order. Here's your receipt:</p>
    <table style="width:100%;border-collapse:collapse" cellpadding="6">
      <thead><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="width:100%;margin-top:12px">
      <tr><td>Subtotal</td><td style="text-align:right">${params.subtotal.toLocaleString()}</td></tr>
      <tr><td>Delivery fee</td><td style="text-align:right">${params.deliveryFee.toLocaleString()}</td></tr>
      <tr><td>Service fee</td><td style="text-align:right">${params.serviceFee.toLocaleString()}</td></tr>
      <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${params.total.toLocaleString()}</strong></td></tr>
    </table>
    <p>We'll update you as your order is packed and delivered.</p>
  `;
}

// Shared by both webhook routes below — same idempotency-claim, process,
// compensate-on-failure shape regardless of which provider is calling.
async function handleConfirmedPayment(params: { provider: string; reference: string; eventReference: string; rawBody: string }) {
  const claim = await query<{ id: string }>(
    `INSERT INTO webhook_events (provider, event_reference) VALUES ($1, $2)
     ON CONFLICT (provider, event_reference) DO NOTHING
     RETURNING id`,
    [params.provider, params.eventReference]
  );
  if (claim.length === 0) return; // already processed

  try {
    await query(
      `UPDATE orders SET payment_status = 'paid', status = 'confirmed', updated_at = now()
       WHERE payment_reference = $1 AND payment_provider = $2`,
      [params.reference, params.provider]
    );

    const rows = await query<Order & { phone: string }>(
      `SELECT o.*, c.phone
       FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE o.payment_reference = $1 AND o.payment_provider = $2`,
      [params.reference, params.provider]
    );
    if (rows.length > 0) {
      const order = rows[0];
      await notifyOrderStatus({ customerPhone: order.phone, orderNumber: order.order_number, status: "confirmed" });
      await sendPushToPhone({
        organizationId: order.organization_id,
        phone: order.phone,
        title: "Order confirmed",
        body: `Your QuickCart order ${order.order_number} has been confirmed.`,
      });
      if (order.customer_email) {
        await sendEmail({
          to: order.customer_email,
          subject: `Your QuickCart order ${order.order_number} is confirmed`,
          html: renderReceiptHtml({
            orderNumber: order.order_number,
            items: order.items_json,
            subtotal: Number(order.subtotal),
            deliveryFee: Number(order.delivery_fee),
            serviceFee: Number(order.service_fee),
            total: Number(order.total),
          }),
        });
      }
    }
    incrementMetric("payments_confirmed_total");
  } catch (err: any) {
    incrementMetric("webhook_failures_total");
    await query(`DELETE FROM webhook_events WHERE provider = $1 AND event_reference = $2`, [
      params.provider,
      params.eventReference,
    ]);
    await query(`INSERT INTO webhook_failures (provider, payload, error_message) VALUES ($1, $2, $3)`, [
      params.provider,
      params.rawBody,
      err.message ?? String(err),
    ]);
    await alertOps({
      subject: `${params.provider} webhook processing failed`,
      message: `Reference: ${params.reference}\nError: ${err.message ?? String(err)}\n\nThis event will be retried by ${params.provider}'s own retry policy. Check the webhook_failures table if it doesn't resolve on retry.`,
    });
    throw err;
  }
}

// No tenant-resolution middleware here — Paystack calls this URL directly
// with no knowledge of your multi-tenant setup, so the organization is
// derived from the order the webhook's reference points to, not a header.
paymentsRouter.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const rawBody = (req.body as Buffer).toString("utf8");
    const signature = req.headers["x-paystack-signature"] as string | undefined;

    if (!paystack.verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody);
    if (event.event === "charge.success") {
      const reference = event.data.reference as string;
      const eventReference = (event.data.id ?? reference).toString();
      await handleConfirmedPayment({ provider: "paystack", reference, eventReference, rawBody });
    }

    res.json({ received: true });
  })
);

// Separate endpoint for Flutterwave's webhook — different payload shape
// and signature scheme entirely, so this isn't just a copy-paste of the
// Paystack handler's outer shell, it's a genuinely different verification
// step feeding the same shared handleConfirmedPayment.
paymentsRouter.post(
  "/webhook/flutterwave",
  asyncHandler(async (req, res) => {
    const rawBody = (req.body as Buffer).toString("utf8");
    const signature = req.headers["verif-hash"] as string | undefined;

    if (!flutterwave.verifyWebhookSignature(signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody);
    if (event.event === "charge.completed" && event.data?.status === "successful") {
      const reference = event.data.tx_ref as string;
      const eventReference = (event.data.id ?? reference).toString();
      await handleConfirmedPayment({ provider: "flutterwave", reference, eventReference, rawBody });
    }

    res.json({ received: true });
  })
);
