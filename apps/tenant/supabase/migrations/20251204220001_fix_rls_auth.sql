-- Fix RLS policies to work with Supabase Auth
-- The users.id should match auth.users.id

-- Drop existing policies
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Platform admins can manage all tenants" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON tenants;
DROP POLICY IF EXISTS "Platform admins can view all roles" ON roles;
DROP POLICY IF EXISTS "Users can view roles in their tenant" ON roles;
DROP POLICY IF EXISTS "Platform admins can manage all roles" ON roles;
DROP POLICY IF EXISTS "Tenant admins can manage roles" ON roles;
DROP POLICY IF EXISTS "Platform admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;
DROP POLICY IF EXISTS "Platform admins can manage all users" ON users;
DROP POLICY IF EXISTS "Tenant admins can manage users" ON users;
DROP POLICY IF EXISTS "Tenant admins can update users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Update function to check platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Check if user has Platform Admin role
  SELECT r.name INTO user_role
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = auth.uid();
  
  RETURN COALESCE(user_role = 'Platform Admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TENANTS TABLE POLICIES
-- Platform admins can see all tenants
CREATE POLICY "Platform admins can view all tenants"
  ON tenants FOR SELECT
  USING (is_platform_admin());

-- Users can view their own tenant
CREATE POLICY "Users can view their own tenant"
  ON tenants FOR SELECT
  USING (
    id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Platform admins can manage all tenants
CREATE POLICY "Platform admins can manage all tenants"
  ON tenants FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Tenant admins can update their own tenant
CREATE POLICY "Tenant admins can update their tenant"
  ON tenants FOR UPDATE
  USING (
    id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  )
  WITH CHECK (
    id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  );

-- ROLES TABLE POLICIES
-- Platform admins can see all roles
CREATE POLICY "Platform admins can view all roles"
  ON roles FOR SELECT
  USING (is_platform_admin());

-- Users can see roles (RLS will filter by tenant context in application)
CREATE POLICY "Users can view roles"
  ON roles FOR SELECT
  USING (true);

-- Platform admins can manage all roles
CREATE POLICY "Platform admins can manage all roles"
  ON roles FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- USERS TABLE POLICIES
-- Platform admins can see all users
CREATE POLICY "Platform admins can view all users"
  ON users FOR SELECT
  USING (is_platform_admin());

-- Users can see users in their tenant
CREATE POLICY "Users can view users in their tenant"
  ON users FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    OR id = auth.uid() -- Users can always see themselves
  );

-- Platform admins can manage all users
CREATE POLICY "Platform admins can manage all users"
  ON users FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Tenant admins can manage users in their tenant
CREATE POLICY "Tenant admins can manage users"
  ON users FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  );

CREATE POLICY "Tenant admins can update users"
  ON users FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users 
      WHERE id = auth.uid() 
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  )
  WITH CHECK (
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

