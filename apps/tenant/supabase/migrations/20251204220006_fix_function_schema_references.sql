-- Fix function schema references to resolve 42P17 error
-- Ensure all policies reference public.is_platform_admin() explicitly

-- Update function to use explicit schema references
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;

-- Update all policies to use explicit schema reference
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON tenants;
CREATE POLICY "Platform admins can view all tenants"
  ON tenants FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Platform admins can manage all tenants" ON tenants;
CREATE POLICY "Platform admins can manage all tenants"
  ON tenants FOR ALL
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Platform admins can view all roles" ON roles;
CREATE POLICY "Platform admins can view all roles"
  ON roles FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Platform admins can manage all roles" ON roles;
CREATE POLICY "Platform admins can manage all roles"
  ON roles FOR ALL
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Platform admins can view all users" ON users;
CREATE POLICY "Platform admins can view all users"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Platform admins can manage all users" ON users;
CREATE POLICY "Platform admins can manage all users"
  ON users FOR ALL
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );
