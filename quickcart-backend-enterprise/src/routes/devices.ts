import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { resolveOrganizationFromHeader } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";

export const devicesRouter = Router();

const registerSchema = z.object({
  phone: z.string().min(7),
  pushToken: z.string().min(1),
  platform: z.enum(["ios", "android"]),
});

// Called by the mobile app once it has a phone number (i.e. after the
// customer's first order, or whenever the app has one cached) and an FCM
// token. No admin auth here — this is a public, customer-facing endpoint
// like /orders, scoped by the same X-Organization-Slug tenant header.
devicesRouter.post(
  "/register",
  resolveOrganizationFromHeader,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof registerSchema>;

    await query(
      `INSERT INTO device_tokens (organization_id, phone, push_token, platform)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, push_token) DO UPDATE SET phone = EXCLUDED.phone`,
      [req.organization!.id, body.phone, body.pushToken, body.platform]
    );

    res.status(201).json({ ok: true });
  })
);
