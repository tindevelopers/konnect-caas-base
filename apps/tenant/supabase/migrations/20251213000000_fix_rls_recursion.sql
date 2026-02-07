-- Fix infinite recursion in users table RLS policies
-- The issue: policies were querying users table from within users table policies

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Allow all operations for authenticated users on users" ON users;
DROP POLICY IF EXISTS "Platform admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;
DROP POLICY IF EXISTS "Platform admins can manage all users" ON users;
DROP POLICY IF EXISTS "Tenant admins can manage users" ON users;
DROP POLICY IF EXISTS "Tenant admins can update users" ON users;

-- Create a security definer function that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT r.name
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

-- Create another helper function for tenant_id
CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id
  FROM users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO service_role;

GRANT EXECUTE ON FUNCTION public.get_current_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_tenant_id() TO anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_tenant_id() TO service_role;

-- Now create non-recursive policies using these functions

-- Policy 1: Users can view themselves
CREATE POLICY "Users can view themselves"
  ON users FOR SELECT
  USING (id = auth.uid());

-- Policy 2: Platform Admins can view all users
CREATE POLICY "Platform admins can view all users"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.get_current_user_role() = 'Platform Admin'
  );

-- Policy 3: Users can view other users in their tenant (exclude platform admins)
CREATE POLICY "Users can view users in their tenant"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND tenant_id IS NOT NULL  -- Exclude platform admins
    AND tenant_id = public.get_current_user_tenant_id()
  );

-- Policy 4: Platform Admins can manage all users
CREATE POLICY "Platform admins can manage all users"
  ON users FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND public.get_current_user_role() = 'Platform Admin'
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.get_current_user_role() = 'Platform Admin'
  );

-- Policy 5: Users can update themselves
CREATE POLICY "Users can update themselves"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Add comment for documentation
COMMENT ON FUNCTION public.get_current_user_role() IS 
  'Security definer function to get current user role without RLS recursion';
COMMENT ON FUNCTION public.get_current_user_tenant_id() IS 
  'Security definer function to get current user tenant_id without RLS recursion';
