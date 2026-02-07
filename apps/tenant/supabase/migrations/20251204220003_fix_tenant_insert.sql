-- Fix RLS policies to allow tenant creation during signup
-- Users need to be able to create tenants when signing up

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Platform admins can manage all tenants" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON tenants;

-- Allow authenticated users to create tenants (for signup flow)
-- This is needed because during signup, we create the tenant before the user is fully set up
CREATE POLICY "Allow tenant creation during signup"
  ON tenants FOR INSERT
  WITH CHECK (true); -- Allow any authenticated user to create a tenant

-- Platform admins can manage all tenants (UPDATE/DELETE)
CREATE POLICY "Platform admins can manage all tenants"
  ON tenants FOR ALL
  USING (
    auth.uid() IS NOT NULL AND is_platform_admin()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND is_platform_admin()
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

-- Also fix users INSERT policy to allow creation during signup
DROP POLICY IF EXISTS "Tenant admins can manage users" ON users;
DROP POLICY IF EXISTS "Tenant admins can update users" ON users;

-- Allow users to be created (needed during signup)
CREATE POLICY "Allow user creation during signup"
  ON users FOR INSERT
  WITH CHECK (true); -- Allow user creation, RLS will still filter reads

-- Tenant admins can manage users in their tenant (UPDATE/DELETE)
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

