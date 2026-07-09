import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { query } from "../db";
import { Organization } from "../types";

declare global {
  namespace Express {
    interface Request {
      organization?: Organization;
    }
  }
}

// Public, customer-facing routes (browse/order) resolve the tenant from an
// X-Organization-Slug header, since there's no logged-in admin user to read
// it from. Each storefront (web app, mobile app) is configured with its
// tenant's slug once, the same way it's configured with an API base URL —
// not something the customer ever sees or types.
//
// Server-to-server callers (a POS, an ERP) instead send X-Api-Key —
// see routes/apiKeys.ts. This resolves the SAME req.organization either
// way, so every downstream route (orders, products, payments) works
// identically regardless of which one was used; they don't need to know
// or care which kind of caller they're serving.
//
// Admin routes resolve the tenant from the authenticated admin_user's
// organization_id instead (see middleware/auth.ts) — an admin can only ever
// act within their own organization, regardless of what header is sent.
export async function resolveOrganizationFromHeader(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) {
    return resolveOrganizationFromApiKey(req, res, next, apiKey);
  }

  const slug = req.headers["x-organization-slug"] as string | undefined;
  if (!slug) {
    return res.status(400).json({ error: "Missing X-Organization-Slug or X-Api-Key header" });
  }

  const orgs = await query<Organization>(
    `SELECT id, name, slug, delivery_fee, convenience_fee, currency, active FROM organizations WHERE slug = $1`,
    [slug]
  );

  if (orgs.length === 0 || !orgs[0].active) {
    return res.status(404).json({ error: "Unknown or inactive organization" });
  }

  req.organization = orgs[0];
  next();
}

async function resolveOrganizationFromApiKey(req: Request, res: Response, next: NextFunction, apiKey: string) {
  const hash = createHash("sha256").update(apiKey).digest("hex");

  const rows = await query<{ organization_id: string }>(
    `SELECT organization_id FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hash]
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: "Invalid or revoked API key" });
  }

  const orgs = await query<Organization>(
    `SELECT id, name, slug, delivery_fee, convenience_fee, currency, active FROM organizations WHERE id = $1`,
    [rows[0].organization_id]
  );
  if (orgs.length === 0 || !orgs[0].active) {
    return res.status(404).json({ error: "Organization is inactive" });
  }

  // Best-effort usage tracking — never let this block the actual request.
  query(`UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1`, [hash]).catch(() => {});

  req.organization = orgs[0];
  next();
}
