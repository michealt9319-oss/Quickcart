-- QuickCart Enterprise schema
-- Adds multi-tenancy, real RBAC, audit logging, and webhook idempotency on
-- top of the Phase 1 data model. See README.md for what this does and
-- does not cover under "enterprise."

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenancy ─────────────────────────────────────────────────────────────
-- Every other table below is scoped to an organization. A single-city
-- QuickCart rollout is one row here; a multi-tenant SaaS deployment is many.
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(80) UNIQUE NOT NULL,
    -- Per-tenant pricing override. NULL falls back to the platform default
    -- in lib/pricing.ts — lets each city/tenant set its own fees without
    -- a code change.
    delivery_fee NUMERIC(10,2),
    convenience_fee NUMERIC(10,2),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── RBAC ────────────────────────────────────────────────────────────────
-- Replaces the single shared ADMIN_PASSWORD from the pilot backend with
-- real per-person accounts and roles.
--   owner   — full access, including managing other admin_users and org settings
--   manager — orders, products, reports
--   support — orders read + status update only, no reports or financial data
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner','manager','support')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (organization_id, email)
);

CREATE TABLE IF NOT EXISTS supermarkets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    zone VARCHAR(100),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    supermarket_id UUID REFERENCES supermarkets(id),
    name VARCHAR(200) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    cost_price NUMERIC(10,2),
    unit VARCHAR(30),
    category VARCHAR(100),
    in_stock BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    default_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    -- Same phone number can exist under different tenants — uniqueness is
    -- per-organization, not global.
    UNIQUE (organization_id, phone)
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    order_number VARCHAR(20) NOT NULL,
    customer_id UUID REFERENCES customers(id),
    supermarket_id UUID REFERENCES supermarkets(id),
    items_json JSONB NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL,
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    service_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','packing','with_rider','delivered','cancelled')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending','paid','failed','refunded')),
    payment_reference VARCHAR(100),
    delivery_address TEXT NOT NULL,
    -- Captured at payment initialization (see POST /payments/initialize) so
    -- a receipt can be emailed on confirmation. Nullable — not every order
    -- has an email (Paystack falls back to a placeholder address if none
    -- is given), in which case the receipt email is simply skipped.
    customer_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (organization_id, order_number)
);

-- ── Audit logging ───────────────────────────────────────────────────────
-- Every admin-authenticated write goes through middleware/audit.ts, which
-- writes a row here. This is the difference between "we think an ops
-- person changed that order" and "we can prove who did, and when."
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    admin_user_id UUID REFERENCES admin_users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Webhook idempotency ─────────────────────────────────────────────────
-- Paystack (like most payment providers) can and does deliver the same
-- webhook event more than once. Without this table, a duplicate delivery
-- could in theory re-trigger a WhatsApp notification twice; it can't
-- double-charge since we never write payment status based on the client,
-- but idempotency is still the correct baseline for any webhook handler.
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(30) NOT NULL,
    event_reference VARCHAR(150) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (provider, event_reference)
);

-- Recorded when webhook processing throws AFTER signature verification
-- passed (e.g. a transient DB error) — the idempotency row above is only
-- inserted on SUCCESS, so a failed event is retried by Paystack's own
-- retry policy and simply visible here for manual follow-up if retries
-- are exhausted, rather than silently disappearing.
CREATE TABLE IF NOT EXISTS webhook_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(30) NOT NULL,
    payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Device push tokens for the mobile app. Keyed by phone rather than a
-- customer_id join, matching how orders/WhatsApp already key off phone
-- number with no customer login required.
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    phone VARCHAR(20) NOT NULL,
    push_token VARCHAR(255) NOT NULL,
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('ios','android')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (organization_id, push_token)
);
CREATE INDEX IF NOT EXISTS idx_device_tokens_org_phone ON device_tokens(organization_id, phone);

CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_org_customer ON orders(organization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_org ON admin_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id, created_at);

-- Safe to re-run against a database that predates these columns.
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'NGN';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_reset_token_hash VARCHAR(255);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(20) DEFAULT 'paystack';

-- Account lockout: increments on each failed login, reset on success.
-- locked_until blocks login attempts entirely until it passes, regardless
-- of whether the password given is now correct — this is what actually
-- stops a credential-stuffing script, not just slowing it down.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- TOTP-based MFA (Google Authenticator / Authy compatible). mfa_secret is
-- only set once MFA setup is confirmed (see routes/mfa.ts) — a secret
-- generated but never confirmed doesn't enable enforcement.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_secret VARCHAR(255);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Real stock tracking instead of a boolean-only flag. stock_quantity is the
-- source of truth; in_stock is kept in sync with it by application logic
-- (see routes/products.ts and routes/orders.ts) rather than being a
-- generated column, since existing rows already have an independently-set
-- in_stock value from before this column existed — a hard switch to a
-- generated column would silently overwrite that on migration.
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 0;

-- Server-to-server API keys (POS integrations, etc.) — scoped to one
-- organization, never to a specific admin user, since these authenticate a
-- SYSTEM, not a person. Only the hash is stored, same reasoning as
-- refresh/reset tokens.
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(12) NOT NULL, -- shown in the UI so an admin can identify which key is which without ever re-displaying the secret
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Delivery zones: a named zone with a center point and radius. Real
-- geofencing needs a delivery address's lat/lng, which needs geocoding
-- (Google/Mapbox) — not implemented here (no API key to call one with).
-- The validation endpoint assumes the CLIENT already has lat/lng (e.g. from
-- a map picker or the device's own GPS) and just checks it against zones.
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    center_lat NUMERIC(10,6) NOT NULL,
    center_lng NUMERIC(10,6) NOT NULL,
    radius_km NUMERIC(6,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Full-text search on product names (and category, since customers often
-- search by type of item). Falls back to the existing ILIKE if this index
-- isn't present for some reason, but this is what makes search resilient
-- to word order / partial matches instead of only substring matching.
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(category, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN (search_vector);

-- Refresh tokens: stored HASHED (never the raw token) so a leaked database
-- backup can't be used to mint sessions. A 12h access token (unchanged from
-- before) plus a longer-lived refresh token means an admin isn't forced to
-- fully re-enter their password every 12 hours, while a stolen refresh
-- token is still revocable (see revoked_at) if you notice it happened.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin_user ON refresh_tokens(admin_user_id);

-- Email verification tokens for self-serve organization signup.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES admin_users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
