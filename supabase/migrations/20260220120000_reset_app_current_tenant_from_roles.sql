-- Remove the incorrect session parameter app.current_tenant from Supabase/PostgREST roles.
-- PostgREST applies impersonated-role settings at transaction start; if a role has
-- "app.current_tenant" set (wrong name), Postgres raises 42704. We only use app.current_tenant_id.
-- This migration RESETs the bad parameter so it is no longer applied. Safe if the setting
-- does not exist (no-op). Run this in the same project where you see the 500.

DO $$
BEGIN
  -- Reset for standard Supabase roles (ignore errors if role or setting missing)
  BEGIN
    ALTER ROLE anon RESET app.current_tenant;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    ALTER ROLE authenticated RESET app.current_tenant;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    ALTER ROLE service_role RESET app.current_tenant;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;
