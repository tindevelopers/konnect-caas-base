# Fixing 500: "unrecognized configuration parameter app.current_tenant"

If you see a **500** on routes that use the database (e.g. `/ai/assistants/...`) with:

```text
Error: {"code": "42704", "message": "unrecognized configuration parameter \"app.current_tenant\""}
```

then something in your deployment is trying to **SET** the Postgres session variable `app.current_tenant`. This repo only uses **`app.current_tenant_id`** for RLS and never sets `app.current_tenant`.

## Fix 1: Reset the parameter from roles (do this first)

PostgREST applies **impersonated-role settings** at the start of each transaction. If a Supabase role has `app.current_tenant` in its default config, every request can trigger the 500.

**Run in order:**
1. `supabase/migrations/20260220120000_reset_app_current_tenant_from_roles.sql` (resets for `anon`, `authenticated`, `service_role`).
2. If the 500 persists, run `supabase/migrations/20260220130000_reset_app_current_tenant_all_roles.sql` (resets for any role that has the setting in the DB).
3. If the 500 still persists, run `docs/SUPABASE_APP_CURRENT_TENANT_DIAGNOSTIC.sql` and use the results to find the source (roles, functions, or pooler/connection).

## Fix 2: Find any other source

### Step-by-step: Supabase Dashboard

1. **Open Database settings**
   - In the left sidebar, click **Database**.
   - Then open **Connection string** (or **Connect** / **Settings** depending on your project’s UI). You may see tabs like “URI”, “Session pooler”, “Transaction pooler”.

2. **Connection string**
   - You’ll see one or more URIs (e.g. `postgres://...` or `postgresql://...`). Copy the one you use for the app (often “Session pooler” or port **5432** for session mode).
   - Check if the URI contains **connection parameters**, e.g. `?options=...` or `?options=-c%20app.current_tenant%3D...`. If you see `app.current_tenant` there, remove it or change it to `app.current_tenant_id`.
   - The Dashboard often shows the URI without extra options; if your app or another service builds the connection string, check that code or env for `options=-c app.current_tenant=...` and fix/remove it.

3. **Database → Settings**
   - Under **Database**, go to **Settings** (or **Database settings**). Look for “Connection pooler”, “Pooler configuration”, or “Session parameters”.
   - If there is a field for **default parameters**, **session variables**, or **Parameter status**, see if `app.current_tenant` is listed. Remove it or change to `app.current_tenant_id`. Many projects don’t have this; if you don’t see it, the SET is likely not from the Dashboard.

4. **Roles**
   - **Database** → **Roles**. Click **authenticated**, **anon**, and **service_role**. Check for “Default configuration” or “Config” and any entry for `app.current_tenant`; remove or change to `app.current_tenant_id`.

5. **If you find nothing**
   - The 500 may be from your app’s env (e.g. `DATABASE_URL` with `?options=...`), another service using the same DB, or a Supabase feature that isn’t visible in the Dashboard. Search your repo and env for `app.current_tenant` and fix there.

## After fixing

Redeploy and retest. The app sets `app.current_tenant_id` via the `set_app_tenant_id` RPC when the tenant cookie is present; RLS uses `get_current_tenant_id()` which reads that (and falls back to `app.current_tenant` or auth metadata).

## Summary

- **Cause:** Something runs `SET app.current_tenant = ...`; Postgres/Supabase rejects it (42704). Often a **role default** applied by PostgREST.
- **Fix:** Run `20260220120000_reset_app_current_tenant_from_roles.sql`, then remove or correct any other source. Use **`app.current_tenant_id`** only.
