# QuickCart — Web Storefront (Enterprise)

The same storefront as the lean `quickcart-web`, rewired to call
`quickcart-backend-enterprise`. Same seven customer-facing screens, plus a full admin section.

## Admin section (`/admin/*`)

Now shares one login (`src/lib/adminAuth.tsx`, a React context) and one role-aware nav bar
(`src/app/admin/layout.tsx`) across six pages:

| Page | Access | What it does |
|---|---|---|
| `/admin/orders` | owner, manager, support | Order queue, status updates |
| `/admin/reports` | owner, manager | KPI summary — revenue, AOV, margin |
| `/admin/products` | owner, manager | Add products, toggle in/out of stock |
| `/admin/team` | owner | Invite manager/support accounts, list team |
| `/admin/settings` | owner | Org name, delivery/convenience fee overrides |
| `/admin/audit-log` | owner | Last 100 recorded admin actions |

The nav bar hides links a logged-in user's role can't use (decoded client-side from the JWT for
UI purposes only — the backend independently enforces every permission regardless of what the
UI shows or hides).

## Tenant resolution

`src/lib/api.ts` resolves which tenant every request is for, in order:
1. `NEXT_PUBLIC_ORGANIZATION_SLUG` — set this for the common case of one deployment per tenant.
2. The first subdomain segment of the current hostname (e.g. `quickcart-lagos.example.com` →
   `quickcart-lagos`) — a fallback so a single deployment can serve multiple tenants without a
   rebuild per tenant, if you go that route instead.

## Setup

```
cp .env.example .env.local
```

Set `NEXT_PUBLIC_API_URL` to your backend, and `NEXT_PUBLIC_ORGANIZATION_SLUG` to your tenant
(create it first via the backend's `/organizations/bootstrap` endpoint).

```
npm install
npm run dev
```

## What's still not here

- No password-reset flow for invited team members — the owner shares a temporary password
  directly (see the note on the Team page). Add email-based reset once you have more than a
  couple of admin users.
- No bulk product import — one product at a time via the form.
- No UI for browsing `webhook_failures` or `/metrics` — query the database / hit the endpoint
  directly for now.

## Added in this pass

- **Supermarket management** (`/admin/supermarkets`) — create/edit/deactivate, matching the
  backend's new supermarket CRUD endpoints.
- **Image upload** on the Products page — uploads directly to storage via a presigned URL (the
  image bytes never pass through our own API); requires the backend's S3 env vars to be set,
  otherwise the upload step returns a clear error rather than silently doing nothing.
- **Password reset flow**: `/admin/forgot-password` → emailed link → `/admin/reset-password`.
  These three pages live in `src/app/admin/` but OUTSIDE the `(dashboard)` route group, which is
  what the login-gating layout wraps — a route group's parentheses don't appear in the URL, so
  `/admin/orders` is unaffected, but the login gate no longer applies to these auth pages,
  which matters since you're by definition not logged in yet when using them.
- **Email verification** page (`/admin/verify-email`) for the backend's self-serve signup flow.
- **Pagination** on Orders and Audit Log (`src/components/Pagination.tsx`, reused by both).
- **CSV export** on Orders, Audit Log, and Reports (`src/lib/csv.ts`) — exports whatever's
  currently loaded on the page, not the full unpaginated result set (see the comment in
  `csv.ts` for why that's a deliberate scope limit, not an oversight).
- **Tests**: Jest + React Testing Library, covering `pricing.ts`, `csv.ts` (including CSV
  escaping edge cases — commas, quotes, newlines), and `jwt.ts`. `.github/workflows/ci.yml` runs
  them plus `next build` on every push.

## Still not here

No product bulk import, no UI for `webhook_failures` (view those in the backend's database
directly), and image upload has no client-side resize/compression — a large photo uploads at
full size.

## Added in this pass (business/launch readiness)

- **Cancel order** button on the customer order-status page (`/order/[id]`), phone-gated,
  matching the backend's cancellation rules (only before an order reaches a rider).
- **Two-factor authentication** setup on the Settings page — QR code, confirm-to-enable,
  disable. The login form now handles the backend's `mfaRequired` response, prompting for a
  6-digit code and re-submitting with the same credentials.

## Backend features from this pass with NO frontend yet

These exist and work via the API, but there's no admin page for them — noting explicitly
rather than leaving it implicit:
- **API keys** (`POST/GET/DELETE /api-keys`) — create, list, and revoke server-to-server keys.
- **Delivery zones** (`/delivery-zones`) — create zones, check a lat/lng against them.
- **GDPR-style export/delete** (`/data-requests/export`, `/data-requests/delete`) — callable via
  curl/Postman today; would need an admin page to be a real workflow rather than a raw API call.

Add these if/when they become an actual workflow bottleneck, not preemptively.
