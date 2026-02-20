# Fixing 500: "unrecognized configuration parameter app.current_tenant"

If you see a **500** on routes that use the database (e.g. `/ai/assistants/...`) with:

```text
Error: {"code": "42704", "message": "unrecognized configuration parameter \"app.current_tenant\""}
```

then something in your deployment is trying to **SET** the Postgres session variable `app.current_tenant`. This repo only uses **`app.current_tenant_id`** for RLS and never sets `app.current_tenant`.

## Fix 1: Reset the parameter from roles (do this first)

PostgREST applies **impersonated-role settings** at the start of each transaction. If a Supabase role has `app.current_tenant` in its default config, every request can trigger the 500.

**Run the migration** `supabase/migrations/20260220120000_reset_app_current_tenant_from_roles.sql` in the Supabase SQL Editor. It runs `ALTER ROLE ... RESET app.current_tenant` for `anon`, `authenticated`, and `service_role` so the bad parameter is no longer applied. Safe to run even if the setting is not present.

## Fix 2: Find any other source

1. **Supabase Dashboard** → **Database** → **Roles**: for `authenticated`, `anon`, `service_role` check "Default configuration" for `app.current_tenant` and remove it or change to `app.current_tenant_id`.
2. **Connection pooler / connection string**: check for options that set `app.current_tenant`; change to **`app.current_tenant_id`** or remove.
3. **SQL / db_pre_request**: if you have SQL that runs `set_config('app.current_tenant', ...)`, change to **`app.current_tenant_id`** or remove that SET.

## After fixing

Redeploy and retest. The app sets `app.current_tenant_id` via the `set_app_tenant_id` RPC when the tenant cookie is present; RLS uses `get_current_tenant_id()` which reads that (and falls back to `app.current_tenant` or auth metadata).

## Summary

- **Cause:** Something runs `SET app.current_tenant = ...`; Postgres/Supabase rejects it (42704). Often a **role default** applied by PostgREST.
- **Fix:** Run `20260220120000_reset_app_current_tenant_from_roles.sql`, then remove or correct any other source. Use **`app.current_tenant_id`** only.
