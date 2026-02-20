# Fixing 500: "unrecognized configuration parameter app.current_tenant"

If you see a **500** on routes that use the database (e.g. `/ai/assistants/...`) with:

```text
Error: {"code": "42704", "message": "unrecognized configuration parameter \"app.current_tenant\""}
```

then something in your deployment is trying to **SET** the Postgres session variable `app.current_tenant`. This repo only uses **`app.current_tenant_id`** for RLS and never sets `app.current_tenant`.

## What to do

1. **Find where `app.current_tenant` is set**
   - **Supabase Dashboard** → Project → **Database** → **Connection string** / **Connection pooler**: check for session or connection options that set a variable named `app.current_tenant`.
   - **Environment / connection string**: look for `options=-c app.current_tenant=...` or similar. Change it to **`app.current_tenant_id`** (with `_id`) or remove it if you don’t need it.
   - Any **custom middleware or proxy** that runs SQL or sets Postgres session variables: ensure it uses **`app.current_tenant_id`**, not `app.current_tenant`.

2. **After fixing the SET**
   - Redeploy and retest. The 500 should stop.
   - RLS uses `get_current_tenant_id()`, which reads `app.current_tenant_id` first, then falls back to `app.current_tenant` (see migration `20260220100000_get_current_tenant_id_fallback.sql`) so both names work for **reading** once the SET uses an allowed parameter.

## Summary

- **Cause:** Something is running `SET app.current_tenant = ...`, which your Postgres/Supabase setup rejects (42704).
- **Fix:** Change that configuration to set **`app.current_tenant_id`** (or remove the incorrect SET). The app and RLS expect **`app.current_tenant_id`**.
