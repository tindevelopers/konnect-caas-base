-- Fix RLS policies to work with client-side queries
-- The issue is that client queries trigger RLS evaluation, and the function needs to be accessible

-- Ensure function is accessible in all contexts
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
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
  -- Use explicit schema references and handle NULL gracefully
  SELECT r.name INTO user_role
  FROM public.users u
  JOIN public.roles r ON u.role_id = r.id
  WHERE u.id = user_id
  LIMIT 1;
  
  -- Return true only if role is Platform Admin, false otherwise
  RETURN COALESCE(user_role = 'Platform Admin', false);
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs, return false (fail secure)
    RETURN false;
END;
$$;

-- Grant execute permission to all roles
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO postgres;

-- Make function available in default search path
ALTER FUNCTION public.is_platform_admin() SET search_path = public;

-- Update RLS policies to be simpler and not rely on function if possible
-- For users table, simplify the policy
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;
CREATE POLICY "Users can view users in their tenant"
  ON users FOR SELECT
  USING (
    -- Users can see themselves
    id = auth.uid()
    OR
    -- Users can see other users in their tenant
    (
      auth.uid() IS NOT NULL
      AND tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid()
      )
    )
    OR
    -- Platform admins can see all (but don't call function if not needed)
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 
        FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() 
        AND r.name = 'Platform Admin'
      )
    )
  );

-- Update tenants policy similarly
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
CREATE POLICY "Users can view their own tenant"
  ON tenants FOR SELECT
  USING (
    -- Users can see their own tenant
    (
      auth.uid() IS NOT NULL
      AND id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid()
      )
    )
    OR
    -- Platform admins can see all
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 
        FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.id = auth.uid() 
        AND r.name = 'Platform Admin'
      )
    )
  );

-- Update roles policy - roles should be visible to all authenticated users
DROP POLICY IF EXISTS "Users can view roles" ON roles;
CREATE POLICY "Users can view roles"
  ON roles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

