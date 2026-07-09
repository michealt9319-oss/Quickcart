import { randomBytes, createHash } from "crypto";

/// Used for refresh tokens, password-reset tokens, and email-verification
/// tokens — anywhere we need a random, one-time, revocable token that isn't
/// a JWT (JWTs aren't easily revocable; these need to be, e.g. "the user
/// clicked reset, invalidate the old link").
///
/// Only the HASH is ever stored in the database — the raw token exists
/// only in the email/response sent to the user, exactly like a password.
/// A stolen database backup then reveals nothing usable.
export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
