import { Router } from "express";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { ASSUMED_RIDER_COST, ASSUMED_PACKAGING_COST, ASSUMED_PAYMENT_FEE_RATE } from "../lib/pricing";

export const reportsRouter = Router();

// Financial data is owner/manager only — support staff can see and update
// orders (routes/admin.ts) but not margin or revenue figures. This is the
// actual difference an "enterprise" role system needs to enforce, not just
// have on paper.
reportsRouter.get(
  "/summary",
  requireAuth,
  requireRole("owner", "manager"),
  asyncHandler(async (req, res) => {
    const { organizationId } = req.admin!;
    const days = Math.max(1, Math.min(365, Number(req.query.days) || 30));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [aggregate] = await query<{
      total_orders: string;
      total_revenue: string | null;
      average_order_value: string | null;
      total_delivery_fees: string | null;
      total_service_fees: string | null;
    }>(
      `SELECT COUNT(*) AS total_orders, SUM(total) AS total_revenue, AVG(total) AS average_order_value,
              SUM(delivery_fee) AS total_delivery_fees, SUM(service_fee) AS total_service_fees
       FROM orders WHERE organization_id = $1 AND payment_status = 'paid' AND created_at >= $2`,
      [organizationId, cutoff]
    );

    const customerCounts = await query<{ customer_id: string; order_count: string }>(
      `SELECT customer_id, COUNT(*) AS order_count FROM orders
       WHERE organization_id = $1 AND payment_status = 'paid' AND created_at >= $2
       GROUP BY customer_id`,
      [organizationId, cutoff]
    );

    const orderLines = await query<{ product_id: string; quantity: number; price: string }>(
      `SELECT line->>'productId' AS product_id, (line->>'quantity')::int AS quantity, (line->>'price')::numeric AS price
       FROM orders o, jsonb_array_elements(o.items_json) AS line
       WHERE o.organization_id = $1 AND o.payment_status = 'paid' AND o.created_at >= $2`,
      [organizationId, cutoff]
    );

    let estimatedProductMargin = 0;
    let lineItemsMissingCost = 0;

    if (orderLines.length > 0) {
      const productIds = [...new Set(orderLines.map((l) => l.product_id))];
      const products = await query<{ id: string; cost_price: string | null }>(
        `SELECT id, cost_price FROM products WHERE id = ANY($1::uuid[]) AND organization_id = $2`,
        [productIds, organizationId]
      );
      const costByProductId = new Map(products.map((p) => [p.id, p.cost_price === null ? null : Number(p.cost_price)]));

      for (const line of orderLines) {
        const cost = costByProductId.get(line.product_id);
        if (cost === null || cost === undefined) {
          lineItemsMissingCost += 1;
          continue;
        }
        estimatedProductMargin += (Number(line.price) - cost) * line.quantity;
      }
    }

    const totalOrders = Number(aggregate.total_orders) || 0;
    const totalRevenue = Number(aggregate.total_revenue) || 0;
    const totalDeliveryFees = Number(aggregate.total_delivery_fees) || 0;
    const totalServiceFees = Number(aggregate.total_service_fees) || 0;

    const estimatedVariableCosts =
      totalOrders * (ASSUMED_RIDER_COST + ASSUMED_PACKAGING_COST) + totalRevenue * ASSUMED_PAYMENT_FEE_RATE;
    const estimatedFeeContribution = totalDeliveryFees + totalServiceFees - estimatedVariableCosts;

    const totalCustomers = customerCounts.length;
    const repeatCustomers = customerCounts.filter((c) => Number(c.order_count) > 1).length;

    res.json({
      periodDays: days,
      orders: {
        total: totalOrders,
        totalRevenue,
        averageOrderValue: Number(aggregate.average_order_value) || 0,
      },
      customers: {
        total: totalCustomers,
        repeat: repeatCustomers,
        repeatRate: totalCustomers > 0 ? repeatCustomers / totalCustomers : 0,
      },
      margin: {
        estimatedProductMargin,
        estimatedFeeContribution,
        estimatedTotalMargin: estimatedProductMargin + estimatedFeeContribution,
        estimatedMarginPerOrder: totalOrders > 0 ? (estimatedProductMargin + estimatedFeeContribution) / totalOrders : 0,
        lineItemsMissingCostPrice: lineItemsMissingCost,
        note: "Estimates — see README for exactly what is and isn't measured directly.",
      },
    });
  })
);
