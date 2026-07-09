import { Router } from "express";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { validateBody } from "../middleware/validate";
import { signAdminToken } from "../middleware/auth";
import { generateOpaqueToken, hashToken } from "../lib/tokens";
import { sendEmail } from "../lib/email";
import { AdminRole } from "../types";

export const authRouter = Router();

const REFRESH_TOKEN_TTL_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function issueRefreshToken(adminUserId: string): Promise<string> {
  const { raw, hash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (admin_user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [adminUserId, hash, expiresAt]
  );
  return raw;
}

const loginSchema = z.object({
  organizationSlug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  // Only required if the account has MFA enabled — the login response
  // tells the client that (mfaRequired: true) so it can prompt and retry
  // with the same credentials plus this code, rather than asking for MFA
  // on every login attempt up front.
  mfaToken: z.string().optional(),
});

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { organizationSlug, email, password, mfaToken } = req.body as z.infer<typeof loginSchema>;

    const rows = await query<{
      id: string;
      organization_id: string;
      password_hash: string;
      role: AdminRole;
      active: boolean;
      failed_login_attempts: number;
      locked_until: string | null;
      mfa_enabled: boolean;
      mfa_secret: string | null;
    }>(
      `SELECT au.id, au.organization_id, au.password_hash, au.role, au.active,
              au.failed_login_attempts, au.locked_until, au.mfa_enabled, au.mfa_secret
       FROM admin_users au
       JOIN organizations o ON o.id = au.organization_id
       WHERE o.slug = $1 AND au.email = $2`,
      [organizationSlug, email]
    );

    // Same error for "no such user" and "wrong password" — do not leak
    // which one it was, that's a user-enumeration vector.
    if (rows.length === 0 || !rows[0].active) {
      return res.status(401).json({ error: "Incorrect email or password" });
    }
    const user = rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return res.status(423).json({
        error: `Too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const attempts = user.failed_login_attempts + 1;
      const lockedUntil =
        attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
      await query(
        `UPDATE admin_users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [attempts, lockedUntil, user.id]
      );
      if (lockedUntil) {
        return res.status(423).json({
          error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`,
        });
      }
      return res.status(401).json({ error: "Incorrect email or password" });
    }

    // Password correct — check MFA before issuing anything.
    if (user.mfa_enabled) {
      if (!mfaToken) {
        return res.status(200).json({ mfaRequired: true });
      }
      const valid = authenticator.verify({ token: mfaToken, secret: user.mfa_secret as string });
      if (!valid) {
        return res.status(401).json({ error: "Incorrect authentication code" });
      }
    }

    // Successful login — reset lockout counters.
    await query(`UPDATE admin_users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [
      user.id,
    ]);

    const accessToken = signAdminToken({
      adminUserId: user.id,
      organizationId: user.organization_id,
      role: user.role,
    });
    const refreshToken = await issueRefreshToken(user.id);

    res.json({ token: accessToken, refreshToken });
  })
);

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

// Rotates the refresh token on every use: the old one is revoked and a new
// one issued, rather than reusing the same refresh token until it expires.
// This limits the damage of a stolen refresh token to a single use — if
// both the legitimate client and an attacker ever try to use the same
// (already-rotated) token, the second attempt fails, which is itself a
// signal worth alerting on if you wire that up later.
authRouter.post(
  "/refresh",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const hash = hashToken(refreshToken);

    const rows = await query<{ id: string; admin_user_id: string; expires_at: string; revoked_at: string | null }>(
      `SELECT id, admin_user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
      [hash]
    );
    if (rows.length === 0 || rows[0].revoked_at || new Date(rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    const users = await query<{ organization_id: string; role: AdminRole; active: boolean }>(
      `SELECT organization_id, role, active FROM admin_users WHERE id = $1`,
      [rows[0].admin_user_id]
    );
    if (users.length === 0 || !users[0].active) {
      return res.status(401).json({ error: "Account no longer active" });
    }

    // Rotate: revoke the token just used, issue a fresh one.
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [rows[0].id]);
    const newRefreshToken = await issueRefreshToken(rows[0].admin_user_id);

    const accessToken = signAdminToken({
      adminUserId: rows[0].admin_user_id,
      organizationId: users[0].organization_id,
      role: users[0].role,
    });
    res.json({ token: accessToken, refreshToken: newRefreshToken });
  })
);

authRouter.post(
  "/logout",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [hashToken(refreshToken)]);
    res.json({ ok: true });
  })
);

const forgotPasswordSchema = z.object({
  organizationSlug: z.string().min(1),
  email: z.string().email(),
});

authRouter.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { organizationSlug, email } = req.body as z.infer<typeof forgotPasswordSchema>;

    const rows = await query<{ id: string }>(
      `SELECT au.id FROM admin_users au JOIN organizations o ON o.id = au.organization_id
       WHERE o.slug = $1 AND au.email = $2`,
      [organizationSlug, email]
    );

    // Always return 200 regardless of whether the account exists — a
    // different response for "no such account" is a user-enumeration leak,
    // same reasoning as the login error message above.
    if (rows.length > 0) {
      const { raw, hash } = generateOpaqueToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await query(
        `UPDATE admin_users SET password_reset_token_hash = $1, password_reset_expires_at = $2 WHERE id = $3`,
        [hash, expiresAt, rows[0].id]
      );

      const resetUrl = `${process.env.WEB_APP_URL}/admin/reset-password?token=${raw}&org=${organizationSlug}`;
      await sendEmail({
        to: email,
        subject: "Reset your QuickCart admin password",
        html: `<p>Click below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      });
    }

    res.json({ ok: true, message: "If that account exists, a reset email has been sent." });
  })
);

const resetPasswordSchema = z.object({
  organizationSlug: z.string().min(1),
  token: z.string().min(1),
  newPassword: z.string().min(10),
});

authRouter.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { organizationSlug, token, newPassword } = req.body as z.infer<typeof resetPasswordSchema>;
    const hash = hashToken(token);

    const rows = await query<{ id: string; password_reset_expires_at: string | null }>(
      `SELECT au.id, au.password_reset_expires_at FROM admin_users au
       JOIN organizations o ON o.id = au.organization_id
       WHERE o.slug = $1 AND au.password_reset_token_hash = $2`,
      [organizationSlug, hash]
    );

    if (rows.length === 0 || !rows[0].password_reset_expires_at || new Date(rows[0].password_reset_expires_at) < new Date()) {
      return res.status(400).json({ error: "Invalid or expired reset link" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query(
      `UPDATE admin_users
       SET password_hash = $1, password_reset_token_hash = NULL, password_reset_expires_at = NULL,
           failed_login_attempts = 0, locked_until = NULL
       WHERE id = $2`,
      [passwordHash, rows[0].id]
    );

    // Revoke all existing refresh tokens on password reset — a changed
    // password should end every existing session, not just future logins.
    await query(`UPDATE refresh_tokens SET revoked_at = now() WHERE admin_user_id = $1 AND revoked_at IS NULL`, [
      rows[0].id,
    ]);

    res.json({ ok: true });
  })
);
