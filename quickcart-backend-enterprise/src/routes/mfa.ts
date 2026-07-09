import { Router } from "express";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { recordAudit } from "../middleware/audit";

export const mfaRouter = Router();

// Step 1: generate a secret and return it as a QR code the admin scans
// with Google Authenticator / Authy / 1Password etc. NOT saved as the
// active secret yet — see /mfa/confirm below. Generating a new secret here
// again before confirming simply replaces the pending one; nothing is
// enforced until confirm succeeds.
mfaRouter.post(
  "/setup",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { adminUserId } = req.admin!;

    const users = await query<{ email: string }>(`SELECT email FROM admin_users WHERE id = $1`, [adminUserId]);
    const email = users[0]?.email ?? "user";

    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(email, "QuickCart", secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Stored but mfa_enabled stays false until /mfa/confirm — a secret that
    // was generated but whose setup was abandoned mid-flow must never
    // silently start being enforced.
    await query(`UPDATE admin_users SET mfa_secret = $1, mfa_enabled = false WHERE id = $2`, [secret, adminUserId]);

    res.json({ secret, qrCodeDataUrl });
  })
);

const confirmSchema = z.object({ token: z.string().min(6).max(6) });

mfaRouter.post(
  "/confirm",
  requireAuth,
  validateBody(confirmSchema),
  asyncHandler(async (req, res) => {
    const { adminUserId, organizationId } = req.admin!;
    const { token } = req.body as z.infer<typeof confirmSchema>;

    const users = await query<{ mfa_secret: string | null }>(`SELECT mfa_secret FROM admin_users WHERE id = $1`, [
      adminUserId,
    ]);
    if (!users[0]?.mfa_secret) {
      return res.status(400).json({ error: "Call /mfa/setup first" });
    }

    const valid = authenticator.verify({ token, secret: users[0].mfa_secret });
    if (!valid) {
      return res.status(401).json({ error: "Incorrect code — check your authenticator app and try again" });
    }

    await query(`UPDATE admin_users SET mfa_enabled = true WHERE id = $1`, [adminUserId]);
    await recordAudit({ organizationId, adminUserId, action: "mfa.enabled" });

    res.json({ ok: true });
  })
);

mfaRouter.post(
  "/disable",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { adminUserId, organizationId } = req.admin!;
    await query(`UPDATE admin_users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1`, [adminUserId]);
    await recordAudit({ organizationId, adminUserId, action: "mfa.disabled" });
    res.json({ ok: true });
  })
);
