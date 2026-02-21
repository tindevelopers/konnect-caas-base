-- Run this in Supabase SQL Editor to find the source of "app.current_tenant".
-- Copy results and share if the 500 persists after running the reset migrations.

-- 1) Roles that have app.current_tenant in their default config (likely cause of 500)
SELECT
  r.rolname AS role_name,
  s.setconfig AS config_entries
FROM pg_db_role_setting s
JOIN pg_roles r ON r.oid = s.setrole
WHERE EXISTS (
  SELECT 1 FROM unnest(s.setconfig) AS elem WHERE elem LIKE 'app.current_tenant%'
);

-- 2) Functions that only READ app.current_tenant (get_current_tenant_id, get_current_tenant_mode) — expected; they are not the cause.
-- 2b) Functions that SET app.current_tenant (these cause the 500 — edit to use app.current_tenant_id or remove the SET)
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc LIKE '%set_config%app.current_tenant%'
   OR p.prosrc LIKE '%SET app.current_tenant%';

-- If (1) returns rows: run migration 20260220130000_reset_app_current_tenant_all_roles.sql.
-- If (2b) returns rows: edit that function to use app.current_tenant_id or remove the SET.
-- If (2) showed only get_current_tenant_id / get_current_tenant_mode: they only read; the SET is elsewhere (role config, pooler, or connection string).
-- If (1) and (2b) empty: see SUPABASE_APP_CURRENT_TENANT_500.md (Fix 2 — pooler/connection).
