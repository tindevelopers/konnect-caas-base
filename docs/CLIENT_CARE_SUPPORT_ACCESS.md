# Client Care Support Access (Design)

## Overview
This document defines a future support-access model where tenant owners can grant
time-limited “Client Care” access for support users to impersonate a tenant.

## Policy (agreed)
- **Platform Admin**: allowed by default (no grant required).
- **Client Care** (support role): requires an active, unexpired grant.
- All impersonation start/stop events must be audited with a required reason.

## Role
- Add a dedicated role: **Client Care** (support users).
- Ensure platform-only routes remain blocked by middleware unless `Platform Admin`.

## Data Model
Table: `tenant_support_access_grants`

Suggested columns:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `granted_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL`
- `granted_to_role TEXT NOT NULL DEFAULT 'Client Care'`
- `reason TEXT`
- `expires_at TIMESTAMPTZ NOT NULL`
- `revoked_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `metadata JSONB DEFAULT '{}'`

Suggested indexes:
- `tenant_id`
- `expires_at`
- `revoked_at`
- composite: `(tenant_id, expires_at DESC)`

## RLS (intended)
- **Tenant owners/admins** can create/revoke grants for their tenant.
- **Client Care** users can read active grants for their tenant(s) only.
- **Platform Admins** can read all grants.

Example policy outline (pseudo):
- `SELECT`:
  - Platform Admin: allowed
  - Tenant Admin: tenant_id matches
  - Client Care: tenant_id matches AND grant active
- `INSERT/UPDATE`:
  - Tenant Admin: allowed for their tenant

## Enforcement
Impersonation start endpoint should:
- Always allow `Platform Admin`.
- For `Client Care`:
  - Require a valid, unexpired, non-revoked grant for the target tenant.
  - Deny otherwise and audit the attempt.

## UI (tenant-facing)
Add a tenant settings page:
- Toggle: “Allow Client Care support”
- Create grant:
  - Duration (minutes/hours/days)
  - Optional reason
- Active grants list with revoke action
- Audit trail (optional)

## Auditing
Use `audit_logs` for:
- Grant created / revoked
- Impersonation start / stop (reason required)
