-- Temporarily disable RLS for admin operations
-- The admin client should bypass RLS, but let's ensure it works

-- For now, let's create a simpler approach:
-- Allow service_role to bypass RLS completely by granting direct access

-- Grant all permissions to service_role (which admin client uses)
GRANT ALL ON public.tenants TO service_role;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.roles TO service_role;

-- Also ensure the function is accessible
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;

-- Verify function exists and is accessible
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_platform_admin' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE EXCEPTION 'Function is_platform_admin() does not exist';
  END IF;
END $$;

