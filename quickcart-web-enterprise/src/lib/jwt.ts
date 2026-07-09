// Decodes the JWT payload WITHOUT verifying the signature — this is only
// used to show/hide UI elements based on role (e.g. hiding the "Settings"
// link from a support-role user). The backend independently enforces every
// permission on every request regardless of what this returns; a user
// could edit this decoded value in devtools and it would change nothing
// except which links they see, since the actual authorization check always
// happens server-side against the real token.
export function decodeJwtPayload(token: string): { adminUserId: string; organizationId: string; role: string } | null {
  try {
    const [, payload] = token.split(".");
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
