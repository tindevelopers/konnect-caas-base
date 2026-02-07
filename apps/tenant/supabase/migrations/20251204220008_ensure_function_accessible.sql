-- Ensure function is accessible and can be called without RLS issues
-- The issue might be that PostgREST is still evaluating RLS even with service_role

-- Recreate function with explicit schema and ensure it's in the search path
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_role TEXT;
  user_id UUID;
BEGIN
  -- Get auth.uid() and check if it's null
  user_id := auth.uid();
  
  -- If no user is authenticated, return false
  IF user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if user has Platform Admin role
  -- Use explicit schema references
  SELECT r.name INTO user_role
  FROM public.users u
  JOIN public.roles r ON u.role_id = r.id
  WHERE u.id = user_id;
  
  -- Return true only if role is Platform Admin, false otherwise
  RETURN COALESCE(user_role = 'Platform Admin', false);
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, return false
    RETURN false;
END;
$$;

-- Grant execute permission to all roles
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO postgres;

-- Verify function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'is_platform_admin'
  ) THEN
    RAISE EXCEPTION 'Function public.is_platform_admin() was not created successfully';
  END IF;
  RAISE NOTICE 'Function public.is_platform_admin() exists and is accessible';
END $$;

