import { query } from "../db";

// Called explicitly at the point of each meaningful write (order status
// change, product edit, admin invite, etc.) rather than as a generic
// catch-all middleware — that way each log entry can record exactly what
// changed (entityId, metadata) instead of just "someone hit this URL."
export async function recordAudit(params: {
  organizationId: string;
  adminUserId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await query(
      `INSERT INTO audit_logs (organization_id, admin_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.organizationId,
        params.adminUserId,
        params.action,
        params.entityType ?? null,
        params.entityId ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ]
    );
  } catch (err) {
    // An audit log failure should never block the underlying action from
    // completing — log it loudly instead so it gets noticed and fixed.
    console.error("Failed to write audit log:", err);
  }
}
