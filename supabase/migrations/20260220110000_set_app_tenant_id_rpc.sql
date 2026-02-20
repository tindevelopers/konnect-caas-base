-- Set app.current_tenant_id for the current session so RLS get_current_tenant_id() can use it.
-- Call this from the app (e.g. after createClient) when tenant is known from cookie/header
-- to avoid relying on external pooler or JWT mapping. Only sets the correct parameter name
-- (app.current_tenant_id); never sets app.current_tenant.

CREATE OR REPLACE FUNCTION public.set_app_tenant_id(tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', COALESCE(tenant_id::text, ''), true);
END;
$$;

COMMENT ON FUNCTION public.set_app_tenant_id(uuid) IS
  'Sets app.current_tenant_id for the current session; used by RLS get_current_tenant_id(). Call from app when tenant is known (e.g. from cookie).';

GRANT EXECUTE ON FUNCTION public.set_app_tenant_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_app_tenant_id(uuid) TO service_role;
