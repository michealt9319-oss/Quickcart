import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { validateBody } from "../middleware/validate";
import { requireAuth, requireRole } from "../middleware/auth";
import { recordAudit } from "../middleware/audit";
import { generateOpaqueToken, hashToken } from "../lib/tokens";
import { sendEmail } from "../lib/email";

export const organizationsRouter = Router();

const bootstrapSchema = z.object({
  bootstrapSecret: z.string(),
  organizationName: z.string().min(1),
  organizationSlug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens only"),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(10),
});

// One-time setup: creates a new organization plus its first owner account.
// Guarded by BOOTSTRAP_SECRET rather than left wide open — in a real
// multi-tenant SaaS deployment you'd eventually replace this with a proper
// self-serve signup flow (email verification, payment, etc.); this is the
// minimum viable version of "how does the first organization get created."
organizationsRouter.post(
  "/bootstrap",
  validateBody(bootstrapSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof bootstrapSchema>;

    if (body.bootstrapSecret !== process.env.BOOTSTRAP_SECRET) {
      return res.status(403).json({ error: "Invalid bootstrap secret" });
    }

    const orgs = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id`,
      [body.organizationName, body.organizationSlug]
    );
    const organizationId = orgs[0].id;

    const passwordHash = await bcrypt.hash(body.ownerPassword, 12);
    await query(
      `INSERT INTO admin_users (organization_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'owner')`,
      [organizationId, body.ownerEmail, passwordHash]
    );

    res.status(201).json({ organizationId, slug: body.organizationSlug });
  })
);

const signupSchema = z.object({
  organizationName: z.string().min(1),
  organizationSlug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers, and hyphens only"),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(10),
});

// Public self-serve signup — no BOOTSTRAP_SECRET required, unlike
// /bootstrap. This is the "someone signs up for QuickCart SaaS" path.
// Deliberately simplified vs. a full production signup: no payment/billing
// step, and login is NOT blocked on email_verified (see note on
// /verify-email below) — add both once you're actually charging tenants or
// worried about throwaway signups, not before.
organizationsRouter.post(
  "/signup",
  validateBody(signupSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof signupSchema>;

    const existingSlug = await query(`SELECT id FROM organizations WHERE slug = $1`, [body.organizationSlug]);
    if (existingSlug.length > 0) {
      return res.status(409).json({ error: "That organization slug is already taken" });
    }

    const orgs = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id`,
      [body.organizationName, body.organizationSlug]
    );
    const organizationId = orgs[0].id;

    const passwordHash = await bcrypt.hash(body.ownerPassword, 12);
    const owners = await query<{ id: string }>(
      `INSERT INTO admin_users (organization_id, email, password_hash, role) VALUES ($1, $2, $3, 'owner') RETURNING id`,
      [organizationId, body.ownerEmail, passwordHash]
    );

    const { raw, hash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await query(
      `INSERT INTO email_verification_tokens (admin_user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [owners[0].id, hash, expiresAt]
    );

    const verifyUrl = `${process.env.WEB_APP_URL}/admin/verify-email?token=${raw}&org=${body.organizationSlug}`;
    await sendEmail({
      to: body.ownerEmail,
      subject: "Verify your QuickCart account",
      html: `<p>Welcome to QuickCart. Verify your email to finish setting up your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    res.status(201).json({ organizationId, slug: body.organizationSlug });
  })
);

const verifyEmailSchema = z.object({
  organizationSlug: z.string().min(1),
  token: z.string().min(1),
});

// NOTE: login does not currently require email_verified = true. This
// endpoint exists so the flow is real end-to-end (token generated, emailed,
// verified, flag flipped) — wiring login to actually block on it is a
// one-line change in routes/auth.ts (`AND au.email_verified = true` in the
// login query) once you decide unverified accounts should be blocked
// rather than just flagged.
organizationsRouter.post(
  "/verify-email",
  validateBody(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const { organizationSlug, token } = req.body as z.infer<typeof verifyEmailSchema>;
    const hash = hashToken(token);

    const rows = await query<{ id: string }>(
      `SELECT evt.id FROM email_verification_tokens evt
       JOIN admin_users au ON au.id = evt.admin_user_id
       JOIN organizations o ON o.id = au.organization_id
       WHERE o.slug = $1 AND evt.token_hash = $2 AND evt.expires_at > now()`,
      [organizationSlug, hash]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired verification link" });
    }

    await query(
      `UPDATE admin_users SET email_verified = true
       WHERE id = (SELECT admin_user_id FROM email_verification_tokens WHERE id = $1)`,
      [rows[0].id]
    );
    await query(`DELETE FROM email_verification_tokens WHERE id = $1`, [rows[0].id]);

    res.json({ ok: true });
  })
);

const inviteSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  role: z.enum(["manager", "support"]), // owners can't self-invite another owner via this endpoint
});

// Owner-only: add a manager/support account to their own organization.
organizationsRouter.post(
  "/admin-users",
  requireAuth,
  requireRole("owner"),
  validateBody(inviteSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof inviteSchema>;
    const { organizationId, adminUserId } = req.admin!;

    const existing = await query(`SELECT id FROM admin_users WHERE organization_id = $1 AND email = $2`, [
      organizationId,
      body.email,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An admin user with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const created = await query<{ id: string }>(
      `INSERT INTO admin_users (organization_id, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [organizationId, body.email, passwordHash, body.role]
    );

    await recordAudit({
      organizationId,
      adminUserId,
      action: "admin_user.invited",
      entityType: "admin_user",
      entityId: created[0].id,
      metadata: { email: body.email, role: body.role },
    });

    res.status(201).json({ id: created[0].id });
  })
);

// Owner-only: list admin users for the team management page.
organizationsRouter.get(
  "/admin-users",
  requireAuth,
  requireRole("owner"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const [countRow] = await query<{ count: string }>(
      `SELECT COUNT(*) FROM admin_users WHERE organization_id = $1`,
      [req.admin!.organizationId]
    );
    const users = await query<{ id: string; email: string; role: string; active: boolean; created_at: string }>(
      `SELECT id, email, role, active, created_at FROM admin_users
       WHERE organization_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [req.admin!.organizationId, limit, offset]
    );
    res.json({ adminUsers: users, page, limit, total: Number(countRow.count) });
  })
);

const settingsSchema = z.object({
  name: z.string().min(1).optional(),
  deliveryFee: z.number().nonnegative().nullable().optional(),
  convenienceFee: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
});

// Owner-only: update org display name and per-tenant fee overrides. NULL
// for either fee reverts that tenant to the platform default in lib/pricing.ts.
organizationsRouter.put(
  "/settings",
  requireAuth,
  requireRole("owner"),
  validateBody(settingsSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof settingsSchema>;
    const { organizationId, adminUserId } = req.admin!;

    const fields: string[] = [];
    const params: any[] = [];
    const fieldMap: Record<string, any> = {
      name: body.name,
      delivery_fee: body.deliveryFee,
      convenience_fee: body.convenienceFee,
      currency: body.currency,
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
    params.push(organizationId);

    await query(`UPDATE organizations SET ${fields.join(", ")} WHERE id = $${params.length}`, params);

    await recordAudit({
      organizationId,
      adminUserId,
      action: "organization.settings_updated",
      entityType: "organization",
      entityId: organizationId,
      metadata: body,
    });

    res.json({ ok: true });
  })
);

// Owner-only: paginated audit trail. This is deliberately read-only and
// append-only elsewhere (see middleware/audit.ts) — there is no edit or
// delete endpoint for audit entries, on purpose.
organizationsRouter.get(
  "/audit-logs",
  requireAuth,
  requireRole("owner"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const [countRow] = await query<{ count: string }>(
      `SELECT COUNT(*) FROM audit_logs WHERE organization_id = $1`,
      [req.admin!.organizationId]
    );
    const logs = await query(
      `SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata, al.created_at, au.email AS admin_email
       FROM audit_logs al
       LEFT JOIN admin_users au ON au.id = al.admin_user_id
       WHERE al.organization_id = $1
       ORDER BY al.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.admin!.organizationId, limit, offset]
    );
    res.json({ auditLogs: logs, page, limit, total: Number(countRow.count) });
  })
);
