-- Reset app.current_tenant for every role that has it in pg_db_role_setting.
-- Use this if 20260220120000 (fixed role names) did not fix the 500; some projects
-- use different or additional role names. Safe to run multiple times.

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
      NULL; -- ignore per-role errors
    END;
  END LOOP;
END;
$$;
