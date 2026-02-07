-- Phase 2.1: Update RLS Policies for Tenant Isolation
-- This migration updates Row Level Security policies to ensure proper tenant isolation

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users on tenants" ON tenants;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on roles" ON roles;
DROP POLICY IF EXISTS "Allow all operations for authenticated users on users" ON users;

-- Create function to get current tenant_id from JWT claims or session
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
DECLARE
  tenant_id UUID;
BEGIN
  -- Try to get tenant_id from JWT claim (set by application)
  tenant_id := current_setting('app.current_tenant_id', true)::UUID;
  
  -- If not set, try to get from auth.users metadata
  IF tenant_id IS NULL THEN
    SELECT (raw_user_meta_data->>'tenant_id')::UUID INTO tenant_id
    FROM auth.users
    WHERE id = auth.uid();
  END IF;
  
  RETURN tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is platform admin
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
  
  RETURN user_role = 'Platform Admin';
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

-- Users can see roles in their tenant
CREATE POLICY "Users can view roles in their tenant"
  ON roles FOR SELECT
  USING (
    id IN (
      SELECT role_id FROM users 
      WHERE tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
    OR id IN (
      SELECT id FROM roles WHERE coverage = 'Global'
    )
  );

-- Platform admins can manage all roles
CREATE POLICY "Platform admins can manage all roles"
  ON roles FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Tenant admins can manage roles in their tenant
CREATE POLICY "Tenant admins can manage roles"
  ON roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
      AND role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  );

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

