import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";
import { resolveOrganizationFromHeader } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { recordAudit } from "../middleware/audit";

export const deliveryZonesRouter = Router();

// Haversine distance in km between two lat/lng points — no external
// geocoding needed for THIS check, since it just compares two coordinates
// the caller already has. Turning a free-text address into coordinates
// (geocoding) is a separate problem this doesn't solve — see the note in
// schema.sql on delivery_zones.
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const createSchema = z.object({
  name: z.string().min(1),
  centerLat: z.number(),
  centerLng: z.number(),
  radiusKm: z.number().positive(),
});

deliveryZonesRouter.post(
  "/",
  requireAuth,
  requireRole("owner", "manager"),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const { organizationId, adminUserId } = req.admin!;

    const created = await query<{ id: string }>(
      `INSERT INTO delivery_zones (organization_id, name, center_lat, center_lng, radius_km)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [organizationId, body.name, body.centerLat, body.centerLng, body.radiusKm]
    );

    await recordAudit({ organizationId, adminUserId, action: "delivery_zone.created", entityType: "delivery_zone", entityId: created[0].id, metadata: body });
    res.status(201).json({ id: created[0].id });
  })
);

deliveryZonesRouter.get(
  "/",
  requireAuth,
  requireRole("owner", "manager", "support"),
  asyncHandler(async (req, res) => {
    const zones = await query(
      `SELECT id, name, center_lat, center_lng, radius_km, active FROM delivery_zones
       WHERE organization_id = $1 ORDER BY name ASC`,
      [req.admin!.organizationId]
    );
    res.json({ deliveryZones: zones });
  })
);

const checkSchema = z.object({ lat: z.number(), lng: z.number() });

// Public — checkout can call this before letting a customer place an
// order, to warn them upfront if their location is outside every active
// zone rather than surprising them after payment. Doesn't BLOCK order
// creation itself (that's a business decision, not an infrastructure one)
// — it just answers "is this point deliverable," leaving the calling
// client to decide what to do with that answer.
deliveryZonesRouter.post(
  "/check",
  resolveOrganizationFromHeader,
  validateBody(checkSchema),
  asyncHandler(async (req, res) => {
    const { lat, lng } = req.body as z.infer<typeof checkSchema>;

    const zones = await query<{ id: string; name: string; center_lat: string; center_lng: string; radius_km: string }>(
      `SELECT id, name, center_lat, center_lng, radius_km FROM delivery_zones
       WHERE organization_id = $1 AND active = true`,
      [req.organization!.id]
    );

    const matching = zones.find(
      (z) => distanceKm(lat, lng, Number(z.center_lat), Number(z.center_lng)) <= Number(z.radius_km)
    );

    res.json({
      deliverable: Boolean(matching),
      zone: matching ? { id: matching.id, name: matching.name } : null,
    });
  })
);
