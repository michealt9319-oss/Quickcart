# QuickCart Backend — Enterprise

A multi-tenant version of `quickcart-backend`, adding real RBAC, audit logging, webhook
idempotency, rate limiting, structured logging, and per-tenant pricing. This is a **separate
project** from the lean pilot backend, not a replacement for it — see the note at the end on
which one you should actually be running.

## What "enterprise" means here, concretely

| Capability | What's built | What's still out of scope |
|---|---|---|
| Multi-tenancy | Every table scoped by `organization_id`; one deployment serves many businesses or many cities of the same business | Per-tenant database isolation (all tenants currently share one Postgres database — this is an infra/hosting decision, not something to code around; revisit at real scale) |
| RBAC | Real accounts (`admin_users`), bcrypt-hashed passwords, three roles enforced per-route, admin user listing | SSO/SAML/OAuth login — a real, separate integration requiring an identity provider |
| Product management | Create, update, soft-delete (owner/manager), all audited | No bulk import — still one product at a time via the API |
| Organization settings | Owner can update name and per-tenant delivery/convenience fee override via API | No settings UI beyond what the web app now provides |
| Audit logging | Every order status change, product write, admin invite, and settings change recorded; readable via `GET /organizations/audit-logs` | No UI-side filtering/search beyond a simple limit — query the table directly for anything more complex |
| Webhook reliability | Idempotency (atomic claim via `ON CONFLICT`), and a corrected failure path: a processing error releases the idempotency claim and logs to `webhook_failures` so Paystack's own retries actually get reprocessed instead of silently dropped | No automatic alerting on `webhook_failures` — check it manually or wire your own alert on that table |
| Push notifications | FCM (legacy HTTP API) wired into order-confirmed and status-change events, device registration endpoint | Uses FCM's legacy key-based API, not the newer v1 OAuth API — see `src/lib/push.ts` for the migration note |
| Rate limiting | In-memory by default; switches to a shared Redis store automatically if `REDIS_URL` is set | You still need to actually run Redis somewhere if you deploy >1 instance — this just makes the code ready for it |
| Observability | Structured JSON logs with request IDs, DB-aware health check, `/metrics` with basic counters (requests, orders, payments, errors) | No dashboards/alerting wired to those metrics — point a real Prometheus/Grafana at `/metrics` yourself |
| Compliance | Input validation (zod), secrets via env vars, redacted logs | No formal certification (SOC 2, ISO 27001), no legal/regulatory review (e.g. NDPR) — those are process and legal work, not code |

If you need the right-hand column for a specific customer or regulatory requirement, say so
explicitly — those are real, separately-scoped projects, not a checkbox to tick.

## The tenant model

One `organizations` row per tenant. A tenant is either:
- **One city/rollout of QuickCart itself** — e.g. a Lagos org and an Abuja org, each with their
  own supermarkets, products, and orders, possibly with different delivery fees.
- **A different business entirely**, if you're running this as white-label SaaS.

Public, customer-facing endpoints (`/products`, `/orders`) require an `X-Organization-Slug`
header identifying the tenant — each storefront (web app, mobile app) is configured with its
tenant's slug once, the same way it's configured with an API base URL. Admin endpoints instead
derive the organization from the logged-in admin's JWT — an admin literally cannot act on
another tenant's data no matter what header they send, because the query always uses
`req.admin.organizationId`, never anything client-supplied.

## Roles

- **owner** — everything, including inviting other admin users and (implicitly, via direct
  SQL for now) organization settings
- **manager** — products, orders, reports
- **support** — orders only (view + update status), no financial/report access

Enforced per-route via `requireRole(...)` — see `src/middleware/auth.ts`. Deliberately no role
hierarchy assumption (owner doesn't automatically "include" manager permissions in code) so
adding a role later can't silently grant access nobody intended.

## Endpoints added in this pass

```
POST   /api/v1/auth/refresh                  exchange a refresh token for a new access token
POST   /api/v1/auth/logout                   revoke a refresh token
POST   /api/v1/auth/forgot-password          request a password reset email
POST   /api/v1/auth/reset-password           reset password using the emailed token
POST   /api/v1/organizations/signup          self-serve org + owner creation (no bootstrap secret)
POST   /api/v1/organizations/verify-email    verify email using the signup token
PUT    /api/v1/products/:id                  update a product (owner/manager)
DELETE /api/v1/products/:id                  soft-delete a product (owner/manager)
GET    /api/v1/supermarkets                  list supermarkets (owner/manager/support)
POST   /api/v1/supermarkets                  create a supermarket (owner/manager)
PUT    /api/v1/supermarkets/:id              update a supermarket (owner/manager)
DELETE /api/v1/supermarkets/:id              soft-delete a supermarket (owner/manager)
GET    /api/v1/orders/history                order history by phone (public, tenant-scoped)
POST   /api/v1/admin/orders/:id/refund       refund via Paystack (owner/manager)
GET    /api/v1/organizations/admin-users     list admin users, paginated (owner)
PUT    /api/v1/organizations/settings        update org name / fees / currency (owner)
GET    /api/v1/organizations/audit-logs      paginated audit trail (owner)
POST   /api/v1/devices/register              register a push token (public, tenant-scoped)
POST   /api/v1/uploads/presign               presigned image upload URL (owner/manager)
GET    /metrics                              Prometheus-style counters (put behind network ACLs)
GET    /docs                                 Swagger UI, generated from openapi.yaml
```

## Testing, Docker, and CI

- `npm test` runs Jest — unit tests for pricing and token logic (no DB needed), plus a couple
  of integration smoke tests via supertest that tolerate no database being available (the
  health check test asserts correct behavior in EITHER the DB-up or DB-down case, since that's
  literally the property a health check needs).
- `docker compose up` runs the API plus a real Postgres locally in one command, migrating the
  schema automatically. Not a production topology — use a managed Postgres in production.
- `.github/workflows/ci.yml` runs the test suite (against a real Postgres service container)
  and the TypeScript build on every push.

## Setup

1. `npm install`
2. `cp .env.example .env` — fill in `DATABASE_URL`, `PAYSTACK_SECRET_KEY`, `JWT_SECRET`
   (`openssl rand -hex 32`), and `BOOTSTRAP_SECRET` (any long random string, used once).
3. `npm run db:migrate`
4. `npm run dev`
5. **Create your first organization and owner account:**
   ```
   curl -X POST http://localhost:4000/api/v1/organizations/bootstrap \
     -H "Content-Type: application/json" \
     -d '{
       "bootstrapSecret": "<your BOOTSTRAP_SECRET>",
       "organizationName": "QuickCart Lagos",
       "organizationSlug": "quickcart-lagos",
       "ownerEmail": "you@quickcart.ng",
       "ownerPassword": "a-real-password-not-this-one"
     }'
   ```
6. Log in as that owner:
   ```
   curl -X POST http://localhost:4000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"organizationSlug":"quickcart-lagos","email":"you@quickcart.ng","password":"..."}'
   ```
   Use the returned token as `Authorization: Bearer <token>` on admin routes.
7. Add a supermarket and products directly via SQL for now (same as the pilot backend — no
   product-management UI yet, deliberately).

In production, rotate or remove access to the bootstrap endpoint once your organizations exist
— it's a superuser-creation endpoint, treat it like one.

## What changes for the web app and mobile app

Both currently assume a single tenant. To use them against this backend:
- Add a configured `ORGANIZATION_SLUG` (web: env var; mobile: `AppConfig`) and send it as
  `X-Organization-Slug` on every request that currently doesn't set it.
- Replace the admin login flow: instead of `POST /admin/login` with just a password, it's now
  `POST /auth/login` with `{ organizationSlug, email, password }`.

This is a real, if fairly mechanical, integration change — not done in this pass, since it
touches two other codebases and you may not need it if you're only running one tenant.

## Which backend should you actually run?

If you're still validating the business (Phase 0-1 from the architecture recommendation doc),
run the lean `quickcart-backend`, not this one — real accounts, audit logs, and rate limiting
solve problems you don't have yet at pilot volume, and the added surface area is pure cost
until you have more than one admin user or more than one tenant. Reach for this once you
actually have a second city, a second admin user who isn't you, or a second business asking to
run QuickCart's model under their own brand.

## Fixes from the last review pass

- **Order creation now checks `in_stock`.** Previously a soft-deleted or out-of-stock product
  could still be added to an order — the product lookup in `routes/orders.ts` now filters on
  `in_stock = true`, and returns a clear "no longer available" error (with the specific
  unavailable product IDs) instead of a generic "not found."
- **Email receipts are now actually sent.** `orders.customer_email` is captured at
  `POST /payments/initialize` (previously only passed through to Paystack and never stored),
  and the webhook sends a real itemized receipt via `lib/email.ts` on `charge.success`,
  alongside the existing WhatsApp/push notifications — same best-effort, non-blocking pattern.
- **Refund endpoint now has a UI** — see the web project's orders page.
- **Self-serve signup now has a UI** — see the web project's `/admin/signup` page.

## Business-readiness layer (this pass)

- **Refresh token rotation** — every `/auth/refresh` call revokes the token used and issues a
  new one, instead of reusing the same refresh token until expiry. Limits a stolen token's
  usefulness to a single use.
- **Account lockout** — 5 failed logins locks the account for 15 minutes (`failed_login_attempts`,
  `locked_until` on `admin_users`). Resets on successful login or password reset.
- **TOTP-based MFA** (`routes/mfa.ts`) — optional per-admin-user, Google Authenticator/Authy
  compatible. `/mfa/setup` returns a QR code; `/mfa/confirm` enforces it only after a valid code
  is entered, so an abandoned setup never silently starts blocking login.
- **Real stock quantity** (`products.stock_quantity`) — order creation now runs in a real
  database transaction with row locking (`FOR UPDATE`), so two simultaneous checkouts for the
  last unit of something can't both succeed. `in_stock` is kept in sync with quantity by
  application logic, not treated as an independent flag that can drift.
- **Customer-initiated cancellation** (`POST /orders/:id/cancel`) — phone-number-gated (same
  trust model as order lookup/history), only allowed before an order reaches a rider, restores
  stock on cancellation.
- **Flutterwave as a second payment provider** (`lib/flutterwave.ts`) — automatic fallback if
  the primary provider's initialization call fails and the other is configured. Refunds route to
  whichever provider actually processed the original payment (`orders.payment_provider`).
- **API keys for server-to-server integration** (`routes/apiKeys.ts`) — an `X-Api-Key` header is
  now a first-class alternative to `X-Organization-Slug` on every public/customer-facing route,
  for a POS or other system pushing orders in directly.

## Launch-readiness layer (this pass)

- **Webhook failure alerting** (`lib/alerting.ts`) — email and/or Slack, fires whenever webhook
  processing fails and gets logged to `webhook_failures`. Configure `OPS_ALERT_EMAIL` and/or
  `SLACK_ALERT_WEBHOOK_URL`.
- **Optional Secrets Manager integration** (`lib/secrets.ts`) — if `SECRETS_MANAGER_ARN` is set,
  secrets are fetched from AWS Secrets Manager at startup and merged into `process.env` for any
  variable not already set locally. Entirely optional — every env var still works exactly as
  before if this isn't configured.
- **GDPR/NDPR-style data export and deletion** (`routes/dataRequests.ts`) — admin-triggered
  (there's no customer login, so a public self-service version keyed only by phone number would
  be an abuse vector), exports everything tied to a phone number as JSON, and anonymizes (not
  hard-deletes) personal data on request — order financial records are retained for accounting,
  which is standard practice under both regimes for that specific reason.
- **Full-text product search** (`products.search_vector`, a generated `tsvector` column) —
  replaces plain `ILIKE` substring matching, so "rice bag" now matches "bag of rice," not just
  exact substrings.
- **Delivery zone validation** (`routes/deliveryZones.ts`) — Haversine distance check against
  named zones with a center point and radius. Does NOT geocode a free-text address into
  lat/lng — that needs Google/Mapbox and an API key this project doesn't have; the client is
  expected to supply lat/lng (from a map picker or device GPS).
- **Legal document templates** (`docs/legal/`) — Terms of Service, Privacy Policy, and Refund
  Policy, drafted to match what this codebase actually does (not generic boilerplate). **These
  require review by a qualified lawyer before publishing** — the templates say so explicitly at
  the top of each file.
- **Security review checklist** (`docs/security/SECURITY_REVIEW.md`) — an honest self-review of
  what's covered and, just as importantly, what a real professional audit needs to check that
  this document can't verify (dependency vulnerabilities, penetration testing, PCI scope).
- **Load test script** (`docs/security/load-test.js`, k6) — covers the read-heavy browse path.
  Has not been run against anything, since nothing in this project has been deployed.
