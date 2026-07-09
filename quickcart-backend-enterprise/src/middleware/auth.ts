import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AdminRole } from "../types";

interface AdminTokenPayload {
  adminUserId: string;
  organizationId: string;
  role: AdminRole;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminTokenPayload;
    }
  }
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: "12h" });
}

// Attaches req.admin if a valid token is present; does not itself enforce a
// role. Combine with requireRole(...) per-route for actual authorization.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET as string) as AdminTokenPayload;
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Role hierarchy is intentionally NOT assumed here (e.g. "owner implies
// manager implies support") — each route lists exactly which roles can
// call it, so adding a new role later can't silently grant access nobody
// intended. A little more typing per route, a lot fewer surprises.
export function requireRole(...allowed: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!allowed.includes(req.admin.role)) {
      return res.status(403).json({ error: `Requires one of: ${allowed.join(", ")}` });
    }
    next();
  };
}
