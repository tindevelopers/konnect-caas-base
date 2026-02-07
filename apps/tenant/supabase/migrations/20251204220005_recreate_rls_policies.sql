-- Recreate RLS policies that were dropped when function was recreated
-- These policies depend on is_platform_admin() function

-- TENANTS TABLE POLICIES
-- Drop existing policies first
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Platform admins can manage all tenants" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON tenants;

-- Platform admins can see all tenants
CREATE POLICY "Platform admins can view all tenants"
  ON tenants FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

-- Users can view their own tenant
CREATE POLICY "Users can view their own tenant"
  ON tenants FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Platform admins can manage all tenants
CREATE POLICY "Platform admins can manage all tenants"
  ON tenants FOR ALL
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

-- Tenant admins can update their own tenant
CREATE POLICY "Tenant admins can update their tenant"
  ON tenants FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  );

-- ROLES TABLE POLICIES
DROP POLICY IF EXISTS "Platform admins can view all roles" ON roles;
DROP POLICY IF EXISTS "Users can view roles" ON roles;
DROP POLICY IF EXISTS "Platform admins can manage all roles" ON roles;

-- Platform admins can see all roles
CREATE POLICY "Platform admins can view all roles"
  ON roles FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

-- Users can see roles
CREATE POLICY "Users can view roles"
  ON roles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- Platform admins can manage all roles
CREATE POLICY "Platform admins can manage all roles"
  ON roles FOR ALL
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

-- USERS TABLE POLICIES
DROP POLICY IF EXISTS "Platform admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;
DROP POLICY IF EXISTS "Platform admins can manage all users" ON users;
DROP POLICY IF EXISTS "Allow user creation during signup" ON users;
DROP POLICY IF EXISTS "Tenant admins can update users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Platform admins can see all users
CREATE POLICY "Platform admins can view all users"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

-- Users can see users in their tenant
CREATE POLICY "Users can view users in their tenant"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    (
      tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
      OR id = auth.uid() -- Users can always see themselves
    )
  );

-- Platform admins can manage all users
CREATE POLICY "Platform admins can manage all users"
  ON users FOR ALL
  USING (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_platform_admin()
  );

-- Allow user creation during signup (admin client bypasses RLS anyway, but this is for safety)
CREATE POLICY "Allow user creation during signup"
  ON users FOR INSERT
  WITH CHECK (true);

-- Tenant admins can update users
CREATE POLICY "Tenant admins can update users"
  ON users FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

