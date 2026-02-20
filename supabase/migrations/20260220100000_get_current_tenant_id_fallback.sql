-- Allow get_current_tenant_id() to read app.current_tenant when app.current_tenant_id is unset.
-- Use case: If your connection pooler or session config sets app.current_tenant (wrong name),
-- RLS can still resolve tenant context. Prefer setting app.current_tenant_id so this fallback
-- is only used when the wrong parameter name cannot be changed.

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
  tenant_id UUID;
BEGIN
  -- Prefer app.current_tenant_id (used by app and RLS)
  tenant_id := current_setting('app.current_tenant_id', true)::UUID;

  -- Fallback: read app.current_tenant if something sets that name (e.g. pooler typo)
  IF tenant_id IS NULL THEN
    BEGIN
      tenant_id := current_setting('app.current_tenant', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
      tenant_id := NULL;
    END;
  END IF;

  -- If not set, try auth.users metadata
  IF tenant_id IS NULL THEN
    SELECT (raw_user_meta_data->>'tenant_id')::UUID INTO tenant_id
    FROM auth.users
    WHERE id = auth.uid();
  END IF;

  RETURN tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
