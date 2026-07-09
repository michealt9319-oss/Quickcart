import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { resolveOrganizationFromHeader } from "../middleware/tenant";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { recordAudit } from "../middleware/audit";
import { Product } from "../types";

export const productsRouter = Router();

// Public browse — scoped by the X-Organization-Slug header, not by an
// admin login, since customers browsing the storefront aren't authenticated.
productsRouter.get(
  "/",
  resolveOrganizationFromHeader,
  asyncHandler(async (req, res) => {
    const { category, search } = req.query as { category?: string; search?: string };
    const conditions: string[] = ["organization_id = $1", "in_stock = true"];
    const params: any[] = [req.organization!.id];
    let orderBy = "name ASC";

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (search) {
      // Full-text search (see search_vector in schema.sql) instead of a
      // plain ILIKE substring match — handles word order, plurals, and
      // multi-word queries ("rice bag" matching "bag of rice") that a
      // substring match would miss entirely. plainto_tsquery treats the
      // input as plain text (not tsquery syntax), so user input can't
      // accidentally construct an invalid or malicious query expression.
      params.push(search);
      conditions.push(`search_vector @@ plainto_tsquery('english', $${params.length})`);
      orderBy = `ts_rank(search_vector, plainto_tsquery('english', $${params.length})) DESC, name ASC`;
    }

    const products = await query<Product>(
      `SELECT id, organization_id, supermarket_id, name, price, unit, category, in_stock, image_url
       FROM products WHERE ${conditions.join(" AND ")} ORDER BY ${orderBy}`,
      params
    );

    res.json({ products });
  })
);

productsRouter.get(
  "/:id",
  resolveOrganizationFromHeader,
  asyncHandler(async (req, res) => {
    const products = await query<Product>(
      `SELECT id, organization_id, supermarket_id, name, price, unit, category, in_stock, image_url
       FROM products WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.organization!.id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ product: products[0] });
  })
);

const upsertProductSchema = z.object({
  supermarketId: z.string().uuid(),
  name: z.string().min(1),
  price: z.number().positive(),
  costPrice: z.number().positive().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  stockQuantity: z.number().int().nonnegative().default(0),
});

// Owner/manager only — the tenant here comes from the admin's own JWT, not
// a header, so an admin can never write products into another organization
// no matter what they send.
productsRouter.post(
  "/",
  requireAuth,
  requireRole("owner", "manager"),
  validateBody(upsertProductSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof upsertProductSchema>;
    const { organizationId, adminUserId } = req.admin!;

    // in_stock is derived from stockQuantity here rather than accepted as
    // a separate field — the two only ever drift apart if something is
    // allowed to set them independently.
    const created = await query<{ id: string }>(
      `INSERT INTO products (organization_id, supermarket_id, name, price, cost_price, unit, category, image_url, stock_quantity, in_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        organizationId,
        body.supermarketId,
        body.name,
        body.price,
        body.costPrice ?? null,
        body.unit ?? null,
        body.category ?? null,
        body.imageUrl ?? null,
        body.stockQuantity,
        body.stockQuantity > 0,
      ]
    );

    await recordAudit({
      organizationId,
      adminUserId,
      action: "product.created",
      entityType: "product",
      entityId: created[0].id,
      metadata: { name: body.name, price: body.price, stockQuantity: body.stockQuantity },
    });

    res.status(201).json({ id: created[0].id });
  })
);

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  costPrice: z.number().positive().nullable().optional(),
  unit: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  inStock: z.boolean().optional(),
  imageUrl: z.string().url().nullable().optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
});

productsRouter.put(
  "/:id",
  requireAuth,
  requireRole("owner", "manager"),
  validateBody(updateProductSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateProductSchema>;
    const { organizationId, adminUserId } = req.admin!;

    // Built dynamically so a partial update only touches the fields sent —
    // avoids accidentally overwriting price with the previous value on a
    // client that only meant to toggle in_stock, for example.
    //
    // If stockQuantity is sent WITHOUT an explicit inStock, in_stock is
    // derived from it automatically (true when > 0) — this is what keeps
    // the two from drifting apart. An explicit inStock in the same request
    // still wins, e.g. "manually mark this out of stock for a day even
    // though we technically have 10 left."
    const fields: string[] = [];
    const params: any[] = [];
    const fieldMap: Record<string, any> = {
      name: body.name,
      price: body.price,
      cost_price: body.costPrice,
      unit: body.unit,
      category: body.category,
      in_stock: body.inStock !== undefined ? body.inStock : body.stockQuantity !== undefined ? body.stockQuantity > 0 : undefined,
      image_url: body.imageUrl,
      stock_quantity: body.stockQuantity,
    };
    for (const [column, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      }
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }
    params.push(req.params.id, organizationId);

    const updated = await query<{ id: string }>(
      `UPDATE products SET ${fields.join(", ")} WHERE id = $${params.length - 1} AND organization_id = $${params.length} RETURNING id`,
      params
    );
    if (updated.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    await recordAudit({
      organizationId,
      adminUserId,
      action: "product.updated",
      entityType: "product",
      entityId: req.params.id,
      metadata: body,
    });

    res.json({ ok: true });
  })
);

productsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("owner", "manager"),
  asyncHandler(async (req, res) => {
    const { organizationId, adminUserId } = req.admin!;

    // Soft delete — in_stock = false and a real deleted flag would be more
    // correct long-term, but this reuses the existing column so past
    // orders' items_json (a point-in-time snapshot) are unaffected either way.
    const deleted = await query<{ id: string }>(
      `UPDATE products SET in_stock = false WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [req.params.id, organizationId]
    );
    if (deleted.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    await recordAudit({
      organizationId,
      adminUserId,
      action: "product.deleted",
      entityType: "product",
      entityId: req.params.id,
    });

    res.json({ ok: true });
  })
);
