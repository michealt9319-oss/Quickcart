import { Router } from "express";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { recordAudit } from "../middleware/audit";

export const apiKeysRouter = Router();

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  // "qc_live_" prefix makes a leaked key recognizable in logs/scans (the
  // same idea as Stripe's "sk_live_..." convention) — a bare hex string
  // leaked in a log line gives no hint what it is or where to revoke it.
  const raw = `qc_live_${randomBytes(24).toString("hex")}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash, prefix: raw.slice(0, 12) };
}

const createSchema = z.object({ name: z.string().min(1) });

// Owner-only — an API key is a standing credential for a whole system
// integration (a POS, an ERP), not something a day-to-day manager account
// should be able to mint. The raw key is returned EXACTLY ONCE here; only
// its hash and prefix are ever stored, same as every other token in this
// codebase (see lib/tokens.ts).
apiKeysRouter.post(
  "/",
  requireAuth,
  requireRole("owner"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as z.infer<typeof createSchema>;
    const { organizationId, adminUserId } = req.admin!;
    const { raw, hash, prefix } = generateApiKey();

    const created = await query<{ id: string }>(
      `INSERT INTO api_keys (organization_id, name, key_hash, key_prefix) VALUES ($1, $2, $3, $4) RETURNING id`,
      [organizationId, name, hash, prefix]
    );

    await recordAudit({
      organizationId,
      adminUserId,
      action: "api_key.created",
      entityType: "api_key",
      entityId: created[0].id,
      metadata: { name },
    });

    res.status(201).json({ id: created[0].id, key: raw, prefix });
  })
);

apiKeysRouter.get(
  "/",
  requireAuth,
  requireRole("owner"),
  asyncHandler(async (req, res) => {
    const keys = await query(
      `SELECT id, name, key_prefix, revoked_at, last_used_at, created_at
       FROM api_keys WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.admin!.organizationId]
    );
    res.json({ apiKeys: keys });
  })
);

apiKeysRouter.delete(
  "/:id",
  requireAuth,
  requireRole("owner"),
  asyncHandler(async (req, res) => {
    const { organizationId, adminUserId } = req.admin!;
    const revoked = await query<{ id: string }>(
      `UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL RETURNING id`,
      [req.params.id, organizationId]
    );
    if (revoked.length === 0) {
      return res.status(404).json({ error: "API key not found or already revoked" });
    }
    await recordAudit({ organizationId, adminUserId, action: "api_key.revoked", entityType: "api_key", entityId: req.params.id });
    res.json({ ok: true });
  })
);
