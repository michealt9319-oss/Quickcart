# Security Review Checklist

> This is a self-review checklist reflecting what this codebase does and doesn't do — it is
> **not a substitute for a professional security audit or penetration test.** Before handling
> real customer payment data at scale, commission an actual audit from a qualified firm. This
> document exists so that audit has a real starting point instead of nothing.

## What's already in place

- [x] Passwords hashed with bcrypt (cost factor 12), never stored in plaintext
- [x] JWTs signed with a server-side secret (`JWT_SECRET`), short-lived (12h) access tokens
- [x] Refresh tokens stored as SHA-256 hashes, rotated on every use, revocable
- [x] Account lockout after 5 failed login attempts (15-minute cooldown)
- [x] Optional TOTP-based MFA for admin accounts
- [x] Role-based access control enforced per-route (owner/manager/support), not just in the UI
- [x] Every table scoped by `organization_id` — one tenant cannot read or write another's data
      via any endpoint, including admin routes (derived from the JWT, not a client-supplied header)
- [x] Input validation (zod) on all mutating endpoints
- [x] Rate limiting (stricter on login), Redis-backed if deployed with >1 instance
- [x] Payment webhook signatures verified (Paystack HMAC-SHA512, Flutterwave verif-hash) before
      any processing
- [x] Webhook idempotency — a duplicate delivery can't double-process a payment
- [x] SQL queries are all parameterized — no string-concatenated SQL anywhere in the codebase
- [x] Audit log for order status changes, admin invites, product/supermarket writes, refunds,
      MFA changes, API key creation/revocation
- [x] Secrets never logged (pino's `redact` config strips `Authorization` headers and any
      `password`/`password_hash` fields from log output)
- [x] `helmet` middleware for standard HTTP security headers
- [x] CORS explicitly configured, not wide open by default in a way that's easy to miss
- [x] API keys and all opaque tokens (refresh, password reset, email verification) stored as
      hashes only — the raw value is shown/emailed exactly once

## What a real audit should specifically check that this document can't verify

- [ ] **Dependency vulnerabilities** — run `npm audit` / Snyk / Dependabot against the actual
      installed dependency tree, which requires `npm install` having actually been run. Not done
      in this environment (no working `npm install` was available while building this).
- [ ] **Penetration testing** — actual attempted exploitation (SQLi, auth bypass, IDOR across
      tenants) against a running instance. Nothing in this codebase has been run, so nothing has
      been penetration tested either.
- [ ] **Rate limit tuning** — current limits (60 req/min general, 10 req/15min login) are
      reasonable starting guesses, not load-tested or attack-tested values.
- [ ] **JWT secret rotation plan** — there's no built-in mechanism to rotate `JWT_SECRET`
      without invalidating every existing session. Fine at low scale; worth a real plan before
      this matters operationally.
- [ ] **PCI DSS scope** — card data never touches this backend (Paystack/Flutterwave host the
      actual payment page), which significantly reduces PCI scope, but "significantly reduces"
      is not "eliminates" — a qualified assessor should confirm your actual PCI obligations
      given your specific integration (SAQ A vs. SAQ A-EP depends on integration details).
- [ ] **NDPR/GDPR compliance beyond the export/delete endpoints** — those endpoints exist
      (`routes/dataRequests.ts`) but a full compliance review covers more than two endpoints:
      lawful basis documentation, breach notification procedures, data processing agreements
      with Paystack/Flutterwave/AWS/your SMTP provider, etc.
- [ ] **Infrastructure security** — firewall rules, database network isolation, TLS
      configuration on whatever host you deploy to — none of this is code, it's deployment
      configuration that depends entirely on where you host this.
- [ ] **Backup and disaster recovery** — no backup strategy is defined anywhere in this project;
      that's a hosting/ops decision to make separately.

## Known accepted trade-offs (not bugs — deliberate, documented decisions)

- Delete-my-data requests are admin-triggered, not public self-service (see
  `routes/dataRequests.ts`) — because there's no customer login, a public endpoint keyed only by
  phone number would let anyone delete anyone's data.
- Order records are anonymized, not hard-deleted, on a deletion request — retained for
  accounting/tax purposes, which is generally permitted under GDPR/NDPR for that specific reason.
- Rate limiting defaults to in-memory (not Redis) unless `REDIS_URL` is set — correct for a
  single instance, insufficient once you run more than one.
