// Every API call in this app goes through here, hitting the standalone
// quickcart-backend-enterprise service. Set NEXT_PUBLIC_API_URL and
// NEXT_PUBLIC_ORGANIZATION_SLUG in .env.local.
const API_BASE = process.env.NEXT_PUBLIC_API_URL;
const ENV_ORG_SLUG = process.env.NEXT_PUBLIC_ORGANIZATION_SLUG;

// Resolves which tenant this request is for. Priority order:
//   1. NEXT_PUBLIC_ORGANIZATION_SLUG — the default, right for one
//      storefront deployment per tenant (the common case).
//   2. The first subdomain segment of the current hostname, e.g.
//      "quickcart-lagos.example.com" -> "quickcart-lagos" — a fallback for
//      the "one deployment serves many tenants" case, so a single Vercel
//      project can serve multiple tenants without a rebuild per tenant.
//      Skipped entirely on localhost/IP hosts, where it wouldn't mean anything.
// Only one of these is actually needed for most setups — having both means
// you don't have to decide up front which model you'll end up using.
export function resolveOrgSlug(): string | undefined {
  if (ENV_ORG_SLUG) return ENV_ORG_SLUG;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isLocalOrIp = host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host);
    const parts = host.split(".");
    if (!isLocalOrIp && parts.length > 2) {
      return parts[0];
    }
  }
  return undefined;
}

if (typeof window !== "undefined") {
  if (!API_BASE) console.warn("NEXT_PUBLIC_API_URL is not set — API calls will fail. See .env.example.");
  if (!resolveOrgSlug()) console.warn("Could not resolve an organization slug (env var unset, and hostname has no subdomain) — public API calls will be rejected by the backend.");
}

async function handle(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

// The org slug header is attached to every request unconditionally. It's
// only actually read by the backend's public routes (products, orders,
// payments) — admin routes derive the tenant from the bearer token instead
// and ignore this header entirely, so sending it there is harmless. Keeping
// it unconditional here avoids every call site needing to know which kind
// of route it's calling.
function tenantHeaders(): Record<string, string> {
  const slug = resolveOrgSlug();
  return slug ? { "X-Organization-Slug": slug } : {};
}

export const api = {
  get: (path: string, opts: { authToken?: string } = {}) =>
    fetch(`${API_BASE}/api/v1${path}`, {
      headers: {
        ...tenantHeaders(),
        ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
      },
    }).then(handle),

  post: (path: string, body: unknown, opts: { authToken?: string } = {}) =>
    fetch(`${API_BASE}/api/v1${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tenantHeaders(),
        ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
      },
      body: JSON.stringify(body),
    }).then(handle),

  put: (path: string, body: unknown, opts: { authToken?: string } = {}) =>
    fetch(`${API_BASE}/api/v1${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...tenantHeaders(),
        ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
      },
      body: JSON.stringify(body),
    }).then(handle),
};
