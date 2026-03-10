# Fix: "unrecognized configuration parameter app.current_tenant"

You've ruled out roles and functions. The source is likely **Supabase pooler** or **connection configuration**. Follow these steps in order.

---

## Step 1: Verify project and re-run reset migration

1. **Confirm you're on the correct Supabase project** — the one linked to your Vercel deployment (`konnect-caas-base`).
2. In **Supabase → SQL Editor**, run the *all-roles* reset (catches any role you might have missed):

```sql
-- Run: supabase/migrations/20260220130000_reset_app_current_tenant_all_roles.sql
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT pg_roles.rolname
    FROM pg_db_role_setting
    JOIN pg_roles ON pg_roles.oid = pg_db_role_setting.setrole
    WHERE EXISTS (
      SELECT 1
      FROM unnest(pg_db_role_setting.setconfig) AS elem
      WHERE elem LIKE 'app.current_tenant%'
    )
  LOOP
    BEGIN
      EXECUTE format('ALTER ROLE %I RESET app.current_tenant', r.rolname);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;
```

3. Redeploy on Vercel and test again.

---

## Step 2: Check Supabase Dashboard

### 2a. Connection string

1. Supabase Dashboard → **Project Settings** (gear icon) → **Database**.
2. Under **Connection string**:
   - Check **URI**, **Session pooler**, **Transaction pooler**.
   - Look for anything like `?options=-c app.current_tenant%3D` or `options=-c%20app.current_tenant` in the URL.
   - If present, remove it or change to `app.current_tenant_id`.

### 2b. Pooler / session parameters

1. **Project Settings** → **Database**.
2. Look for:
   - **Connection pooling** or **Pooler**.
   - **Session parameters**, **Default parameters**, or **Pooler configuration**.
3. If you see `app.current_tenant` anywhere, delete it or change to `app.current_tenant_id`.

### 2c. Roles (manual check)

1. **Database** → **Roles**.
2. Open **anon**, **authenticated**, **service_role**.
3. Under **Default configuration** or **Config**, ensure there is no `app.current_tenant`. If there is, remove it.

---

## Step 3: Check Vercel environment variables

1. Vercel Dashboard → your project → **Settings** → **Environment Variables**.
2. Search for:
   - `DATABASE_URL`
   - `SUPABASE_DB_URL`
   - `DIRECT_URL`
   - Any variable whose value is a Postgres connection string.
3. Ensure none of these contain `app.current_tenant` or `options=-c app.current_tenant` in the query string.
4. If you change anything, redeploy.

---

## Step 4: Contact Supabase support (if still failing)

If the error continues after Steps 1–3:

1. Go to [Supabase Support](https://supabase.com/dashboard/support) or your usual support channel.
2. Use a message like this:

```
Subject: 500 - "unrecognized configuration parameter app.current_tenant" (code 42704)

Project: [your project ref]

Issue: Our app receives 500 errors when using the database. The error is:
  {"code":"42704","message":"unrecognized configuration parameter \"app.current_tenant\""}

We use app.current_tenant_id (correct) for RLS. Something in the connection path is trying to SET app.current_tenant (incorrect name).

We have:
- Run migrations to reset app.current_tenant from anon, authenticated, service_role (and all roles via pg_db_role_setting)
- Confirmed no roles have app.current_tenant in pg_db_role_setting
- Confirmed no database functions SET app.current_tenant

Please check:
1. Whether the connection pooler (Supavisor) applies app.current_tenant as a default session parameter.
2. Any project-level or pooler config that sets app.current_tenant.

We need the source of the SET to be removed or changed to app.current_tenant_id.
```

---

## Summary

| Step | Action |
|------|--------|
| 1 | Run 20260220130000 migration, redeploy, retest |
| 2 | Check Supabase: connection string, pooler, roles |
| 3 | Check Vercel: DATABASE_URL and related env vars |
| 4 | Contact Supabase support if needed |
