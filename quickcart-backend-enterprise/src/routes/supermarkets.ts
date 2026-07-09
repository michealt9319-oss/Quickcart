import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { recordAudit } from "../middleware/audit";

export const supermarketsRouter = Router();

supermarketsRouter.get(
  "/",
  requireAuth,
  requireRole("owner", "manager", "support"),
  asyncHandler(async (req, res) => {
    const supermarkets = await query(
      `SELECT id, name, phone, zone, active FROM supermarkets WHERE organization_id = $1 ORDER BY name ASC`,
      [req.admin!.organizationId]
    );
    res.json({ supermarkets });
  })
);

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  zone: z.string().optional(),
});

supermarketsRouter.post(
  "/",
  requireAuth,
  requireRole("owner", "manager"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const { organizationId, adminUserId } = req.admin!;

    const created = await query<{ id: string }>(
      `INSERT INTO supermarkets (organization_id, name, phone, zone) VALUES ($1, $2, $3, $4) RETURNING id`,
      [organizationId, body.name, body.phone ?? null, body.zone ?? null]
    );

    await recordAudit({
      organizationId,
      adminUserId,
      action: "supermarket.created",
      entityType: "supermarket",
      entityId: created[0].id,
      metadata: { name: body.name },
    });

    res.status(201).json({ id: created[0].id });
  })
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  zone: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

supermarketsRouter.put(
  "/:id",
  requireAuth,
  requireRole("owner", "manager"),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateSchema>;
    const { organizationId, adminUserId } = req.admin!;

    const fields: string[] = [];
    const params: any[] = [];
    for (const [column, value] of Object.entries({ name: body.name, phone: body.phone, zone: body.zone, active: body.active })) {
      if (value !== undefined) {
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    params.push(req.params.id, organizationId);

    const updated = await query<{ id: string }>(
      `UPDATE supermarkets SET ${fields.join(", ")} WHERE id = $${params.length - 1} AND organization_id = $${params.length} RETURNING id`,
      params
    );
    if (updated.length === 0) return res.status(404).json({ error: "Supermarket not found" });

    await recordAudit({ organizationId, adminUserId, action: "supermarket.updated", entityType: "supermarket", entityId: req.params.id, metadata: body });
    res.json({ ok: true });
  })
);

// Soft delete (active = false) — orders already placed reference the
// supermarket by id, so a hard delete would break historical order lookups.
supermarketsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("owner", "manager"),
  asyncHandler(async (req, res) => {
    const { organizationId, adminUserId } = req.admin!;
    const deleted = await query<{ id: string }>(
      `UPDATE supermarkets SET active = false WHERE id = $1 AND organization_id = $2 RETURNING id`,
      [req.params.id, organizationId]
    );
    if (deleted.length === 0) return res.status(404).json({ error: "Supermarket not found" });

    await recordAudit({ organizationId, adminUserId, action: "supermarket.deleted", entityType: "supermarket", entityId: req.params.id });
    res.json({ ok: true });
  })
);
