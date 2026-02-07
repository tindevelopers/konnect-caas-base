-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended')),
  plan TEXT NOT NULL,
  region TEXT NOT NULL,
  avatar_url TEXT,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  coverage TEXT NOT NULL,
  max_seats INTEGER NOT NULL DEFAULT 0,
  current_seats INTEGER NOT NULL DEFAULT 0,
  permissions TEXT[] DEFAULT '{}',
  gradient TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'suspended')),
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
-- For now, allow all operations for authenticated users
-- You should customize these based on your security requirements

CREATE POLICY "Allow all operations for authenticated users on tenants"
  ON tenants FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on roles"
  ON roles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users on users"
  ON users FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default roles
INSERT INTO roles (name, description, coverage, max_seats, current_seats, permissions, gradient)
VALUES
  ('Platform Admin', 'Full system control, audit exports, billing + API scope.', 'Global', 40, 32, ARRAY['All permissions', 'Billing', 'API keys', 'Audit logs'], 'from-indigo-500 to-purple-500'),
  ('Workspace Admin', 'Brand, roles, data residency, tenant level automations.', 'Regional', 180, 128, ARRAY['Workspace settings', 'User management', 'Branding'], 'from-emerald-500 to-teal-500'),
  ('Billing Owner', 'Plan changes, usage alerts, dunning + collections.', 'Per tenant', 60, 44, ARRAY['Billing', 'Usage reports', 'Payment methods'], 'from-amber-500 to-orange-500'),
  ('Developer', 'API keys, webhooks, environments, feature flags.', 'Per project', 500, 310, ARRAY['API access', 'Webhooks', 'Feature flags'], 'from-sky-500 to-blue-500'),
  ('Viewer', 'Read-only access to dashboards and reports.', 'Per workspace', 200, 89, ARRAY['View dashboards', 'View reports'], 'from-gray-400 to-gray-600')
ON CONFLICT (name) DO NOTHING;

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

-- Fix RLS policies to handle unauthenticated users gracefully
-- This prevents 500 errors when users aren't logged in yet

-- Update function to check platform admin (handle null auth.uid)
CREATE OR REPLACE FUNCTION is_platform_admin()
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
  SELECT r.name INTO user_role
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE u.id = user_id;
  
  RETURN COALESCE(user_role = 'Platform Admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate tenants policies to handle unauthenticated users
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;

-- Platform admins can see all tenants
CREATE POLICY "Platform admins can view all tenants"
  ON tenants FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND is_platform_admin()
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

-- Drop and recreate users policies
DROP POLICY IF EXISTS "Platform admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;

-- Platform admins can see all users
CREATE POLICY "Platform admins can view all users"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND is_platform_admin()
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

-- Drop and recreate roles policies
DROP POLICY IF EXISTS "Platform admins can view all roles" ON roles;
DROP POLICY IF EXISTS "Users can view roles" ON roles;

-- Platform admins can see all roles
CREATE POLICY "Platform admins can view all roles"
  ON roles FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND is_platform_admin()
  );

-- Users can see roles (but RLS will filter in application)
CREATE POLICY "Users can view roles"
  ON roles FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

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

-- Fix function error 42P17
-- Ensure is_platform_admin function exists and works correctly

-- Drop and recreate the function to ensure it's correct
DROP FUNCTION IF EXISTS public.is_platform_admin() CASCADE;

-- Create function to check if user is platform admin
-- Handle null auth.uid() gracefully
-- Explicitly create in public schema
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
  -- Use COALESCE to handle NULL values
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO service_role;

-- Ensure the function is accessible
ALTER FUNCTION public.is_platform_admin() OWNER TO postgres;

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

-- Fix tenant RLS policy to ensure users can view their own tenant
-- The issue might be that the policy is too restrictive

-- Drop existing tenant SELECT policies
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON tenants;

-- Create a simpler policy that allows users to see their tenant
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
    -- Platform admins can see all tenants
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

-- Also ensure the policy allows the query to work
-- If no policies match, return empty result instead of error
-- This is handled by RLS automatically

-- Set Platform Admins to tenant_id = NULL
-- Platform Admins are system-level users, not tied to any tenant

-- Update existing Platform Admins to have tenant_id = NULL
UPDATE users
SET tenant_id = NULL
WHERE role_id IN (
  SELECT id FROM roles WHERE name = 'Platform Admin'
)
AND tenant_id IS NOT NULL;

-- Add comment to clarify Platform Admin structure
COMMENT ON COLUMN users.tenant_id IS 'Tenant ID for tenant-scoped users. NULL for Platform Admins (system-level users).';

-- Create index for better query performance
-- Note: We can't use subqueries in WHERE clauses, so we'll create partial indexes differently
-- Create a function-based index approach or use a simpler index

-- Index for Platform Admins (tenant_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_users_platform_admin ON users(role_id, tenant_id) 
WHERE tenant_id IS NULL;

-- Index for Organization Admins (Workspace Admins with tenant_id)
CREATE INDEX IF NOT EXISTS idx_users_workspace_admin ON users(role_id, tenant_id) 
WHERE tenant_id IS NOT NULL;

-- Update RLS policies to properly handle Platform Admins with NULL tenant_id

-- Drop existing user policies that might conflict
DROP POLICY IF EXISTS "Platform admins can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in their tenant" ON users;

-- Platform Admins can see all users (including other Platform Admins and all tenant users)
CREATE POLICY "Platform admins can view all users"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

-- Users can see users in their tenant (excluding Platform Admins)
CREATE POLICY "Users can view users in their tenant"
  ON users FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Users can see themselves
      id = auth.uid()
      OR
      -- Users can see other users in their tenant (but not Platform Admins)
      (
        tenant_id IN (
          SELECT tenant_id 
          FROM public.users 
          WHERE id = auth.uid()
          AND tenant_id IS NOT NULL
        )
        AND tenant_id IS NOT NULL  -- Exclude Platform Admins (NULL tenant_id)
      )
    )
  );

-- Update Platform Admin management policy
DROP POLICY IF EXISTS "Platform admins can manage all users" ON users;
CREATE POLICY "Platform admins can manage all users"
  ON users FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

-- Add database-level constraints for tenant isolation
-- This migration adds constraints to ensure data integrity

-- Add check constraint for tenant status
ALTER TABLE tenants
ADD CONSTRAINT check_tenant_status 
CHECK (status IN ('active', 'pending', 'suspended'));

-- Add check constraint for user status
ALTER TABLE users
ADD CONSTRAINT check_user_status 
CHECK (status IN ('active', 'pending', 'suspended'));

-- Ensure tenant_id is set for non-platform-admin users
-- Platform Admins have tenant_id = NULL, regular users must have tenant_id
-- This is enforced at application level, but we add a comment for clarity
COMMENT ON COLUMN users.tenant_id IS 
  'NULL for Platform Admins (system-level), UUID for tenant-scoped users';

-- Add index for tenant_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_tenant_id_status 
ON users(tenant_id, status) 
WHERE tenant_id IS NOT NULL;

-- Add index for platform admins (tenant_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_users_platform_admin 
ON users(role_id) 
WHERE tenant_id IS NULL;

-- Add constraint to ensure domain uniqueness
-- (Already exists via UNIQUE constraint, but adding explicit name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_domain_key'
  ) THEN
    ALTER TABLE tenants 
    ADD CONSTRAINT tenants_domain_key UNIQUE (domain);
  END IF;
END $$;

-- Add constraint to ensure email uniqueness
-- (Already exists via UNIQUE constraint, but adding explicit name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

-- Add constraint to ensure role name uniqueness
-- (Already exists via UNIQUE constraint, but adding explicit name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'roles_name_key'
  ) THEN
    ALTER TABLE roles 
    ADD CONSTRAINT roles_name_key UNIQUE (name);
  END IF;
END $$;

-- Add check constraint for plan values (common plans)
ALTER TABLE tenants
ADD CONSTRAINT check_tenant_plan 
CHECK (plan IN ('starter', 'professional', 'enterprise', 'custom') OR plan IS NULL);

-- Add check constraint for user plan values
ALTER TABLE users
ADD CONSTRAINT check_user_plan 
CHECK (plan IN ('starter', 'professional', 'enterprise', 'custom') OR plan IS NULL);

-- Add comment for tenant_id foreign key
COMMENT ON COLUMN users.tenant_id IS 
  'Foreign key to tenants table. NULL for Platform Admins, required for tenant-scoped users.';

-- Add comment for role_id foreign key
COMMENT ON COLUMN users.role_id IS 
  'Foreign key to roles table. Defines user permissions and access level.';

-- Create audit_logs table for permission and access logging
-- This table stores all permission checks and access attempts for compliance

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  permission TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_permission ON audit_logs(permission);
CREATE INDEX IF NOT EXISTS idx_audit_logs_allowed ON audit_logs(allowed);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_tenant_action 
ON audit_logs(user_id, tenant_id, action, created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Platform Admins can view all audit logs
CREATE POLICY "Platform admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
      AND u.tenant_id IS NULL
    )
  );

-- Users can view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());

-- Tenant Admins can view audit logs for their tenant
CREATE POLICY "Tenant admins can view tenant audit logs"
  ON audit_logs FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 
      FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name IN ('Platform Admin', 'Workspace Admin')
    )
  );

-- Only system can insert audit logs (via service role)
-- Regular users cannot insert audit logs directly
-- This is enforced by using admin client in audit-log.ts

-- Add comment
COMMENT ON TABLE audit_logs IS 
  'Stores audit trail of all permission checks and access attempts for compliance and security';




-- Phase 5.1: Workspaces/Organization Model
-- Create workspaces table to support multiple workspaces per tenant

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique slug per tenant
  UNIQUE(tenant_id, slug)
);

-- Create workspace_users junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  permissions TEXT[] DEFAULT '{}',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure user can only be in workspace once
  UNIQUE(workspace_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspace_users_workspace_id ON workspace_users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_user_id ON workspace_users(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_users_role_id ON workspace_users(role_id);

-- Create function to update updated_at timestamp for workspaces
CREATE OR REPLACE FUNCTION update_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_workspaces_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workspaces table
-- Platform admins can view all workspaces
CREATE POLICY "Platform admins can view all workspaces"
  ON workspaces FOR SELECT
  USING (is_platform_admin());

-- Users can view workspaces in their tenant
CREATE POLICY "Users can view workspaces in their tenant"
  ON workspaces FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    OR tenant_id = get_current_tenant_id()
  );

-- Platform admins can manage all workspaces
CREATE POLICY "Platform admins can manage all workspaces"
  ON workspaces FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Tenant admins can manage workspaces in their tenant
CREATE POLICY "Tenant admins can manage workspaces"
  ON workspaces FOR ALL
  USING (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.tenant_id = get_current_tenant_id()
      AND users.role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  )
  WITH CHECK (
    tenant_id = get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.tenant_id = get_current_tenant_id()
      AND users.role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
    )
  );

-- RLS Policies for workspace_users table
-- Platform admins can view all workspace-user relationships
CREATE POLICY "Platform admins can view all workspace users"
  ON workspace_users FOR SELECT
  USING (is_platform_admin());

-- Users can view workspace-user relationships for workspaces they belong to
CREATE POLICY "Users can view workspace users for their workspaces"
  ON workspace_users FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    )
    OR workspace_id IN (
      SELECT id FROM workspaces 
      WHERE tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Platform admins can manage all workspace-user relationships
CREATE POLICY "Platform admins can manage workspace users"
  ON workspace_users FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Tenant admins can manage workspace-user relationships in their tenant
CREATE POLICY "Tenant admins can manage workspace users"
  ON workspace_users FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces 
      WHERE tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.tenant_id = get_current_tenant_id()
        AND users.role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
      )
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces 
      WHERE tenant_id = get_current_tenant_id()
      AND EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.tenant_id = get_current_tenant_id()
        AND users.role_id IN (SELECT id FROM roles WHERE name IN ('Platform Admin', 'Workspace Admin'))
      )
    )
  );

-- Add default workspace creation trigger
-- When a tenant is created, automatically create a default workspace
CREATE OR REPLACE FUNCTION create_default_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspaces (tenant_id, name, slug, description)
  VALUES (
    NEW.id,
    NEW.name || ' Workspace',
    'default',
    'Default workspace for ' || NEW.name
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to create default workspace on tenant creation
CREATE TRIGGER create_default_workspace_on_tenant_create
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_workspace();




-- Phase 5.6: Add workspace_id to audit_logs for workspace-level auditing
-- This allows tracking actions at both tenant and workspace levels

-- Add workspace_id column to audit_logs
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;

-- Create index for workspace_id queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON audit_logs(workspace_id);

-- Update composite index to include workspace_id
DROP INDEX IF EXISTS idx_audit_logs_user_tenant_action;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_tenant_workspace_action 
ON audit_logs(user_id, tenant_id, workspace_id, action, created_at DESC);

-- Update RLS policy to include workspace filtering
-- Users can view audit logs for workspaces they belong to
DROP POLICY IF EXISTS "Users can view workspace audit logs" ON audit_logs;
CREATE POLICY "Users can view workspace audit logs"
  ON audit_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    )
    OR workspace_id IS NULL -- Include tenant-level logs
  );

-- Add comment
COMMENT ON COLUMN audit_logs.workspace_id IS 
  'Optional workspace_id for workspace-scoped audit logs. NULL indicates tenant-level action.';




-- Migration: Add user_tenant_roles table for Platform Admins to have tenant-specific roles
-- This allows Platform Admins to also act as Workspace Admins (Organization Admins) for specific tenants

-- Create user_tenant_roles junction table
CREATE TABLE IF NOT EXISTS user_tenant_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, tenant_id, role_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user_id ON user_tenant_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_tenant_id ON user_tenant_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_role_id ON user_tenant_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_tenant_roles_user_tenant ON user_tenant_roles(user_id, tenant_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_user_tenant_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_tenant_roles_updated_at
  BEFORE UPDATE ON user_tenant_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_tenant_roles_updated_at();

-- Enable RLS
ALTER TABLE user_tenant_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tenant_roles
-- Platform Admins can view all user-tenant roles
CREATE POLICY "Platform admins can view all user tenant roles"
  ON user_tenant_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
    )
  );

-- Users can view their own tenant roles
CREATE POLICY "Users can view their own tenant roles"
  ON user_tenant_roles FOR SELECT
  USING (user_id = auth.uid());

-- Users can view tenant roles for their tenant
CREATE POLICY "Tenant admins can view tenant roles"
  ON user_tenant_roles FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.tenant_id = user_tenant_roles.tenant_id
      AND r.name IN ('Platform Admin', 'Workspace Admin')
    )
  );

-- Platform Admins can manage all user-tenant roles
CREATE POLICY "Platform admins can manage all user tenant roles"
  ON user_tenant_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = 'Platform Admin'
    )
  );

-- Tenant Admins can manage roles for their tenant
CREATE POLICY "Tenant admins can manage roles for their tenant"
  ON user_tenant_roles FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.tenant_id = user_tenant_roles.tenant_id
      AND r.name IN ('Platform Admin', 'Workspace Admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND u.tenant_id = user_tenant_roles.tenant_id
      AND r.name IN ('Platform Admin', 'Workspace Admin')
    )
  );

-- Add comment
COMMENT ON TABLE user_tenant_roles IS 
  'Junction table allowing Platform Admins to have tenant-specific roles (e.g., Workspace Admin for specific tenants)';

COMMENT ON COLUMN user_tenant_roles.user_id IS 
  'User who has the tenant role. Typically Platform Admins who also need tenant-level access.';

COMMENT ON COLUMN user_tenant_roles.tenant_id IS 
  'Tenant for which the user has the role.';

COMMENT ON COLUMN user_tenant_roles.role_id IS 
  'Role assigned to the user for this tenant (typically Workspace Admin).';

-- Migration: Update role names to match Google/HubSpot organization scheme
-- Changes "Workspace Admin" to "Organization Admin" to better reflect the hierarchy

-- Update the role name and description
UPDATE roles
SET 
  name = 'Organization Admin',
  description = 'Manages their organization: users, teams, settings, and day-to-day operations within their company.'
WHERE name = 'Workspace Admin';

-- Update any existing users who have the old role name
-- (This is safe because we're updating by role_id, not name)

-- Update the Platform Admin description to be clearer
UPDATE roles
SET description = 'Tenant Admin: Full platform control, manages all organizations, domains, billing, security policies, and system-level settings.'
WHERE name = 'Platform Admin';

-- Update other role descriptions for clarity
UPDATE roles
SET description = 'Manages billing and subscriptions for their organization: plan changes, payment methods, usage alerts, and invoicing.'
WHERE name = 'Billing Owner';

UPDATE roles
SET description = 'Technical access for developers: API keys, webhooks, integrations, feature flags, and deployment environments.'
WHERE name = 'Developer';

UPDATE roles
SET description = 'Read-only access to organization data: dashboards, reports, and analytics without modification rights.'
WHERE name = 'Viewer';




-- Add white label settings to tenants table
-- This migration adds branding, theme, email, and CSS customization fields

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS custom_css TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS custom_domains JSONB DEFAULT '[]'::jsonb;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_tenants_branding ON tenants USING GIN (branding);
CREATE INDEX IF NOT EXISTS idx_tenants_theme_settings ON tenants USING GIN (theme_settings);

-- Add comment explaining the JSONB structure
COMMENT ON COLUMN tenants.branding IS 'Branding settings: {companyName, logo, favicon, primaryColor, secondaryColor, supportEmail, supportPhone}';
COMMENT ON COLUMN tenants.theme_settings IS 'Theme settings: {themeMode, fontFamily, fontSize, borderRadius, enableAnimations, enableRipple}';
COMMENT ON COLUMN tenants.email_settings IS 'Email customization: {fromName, fromEmail, replyTo, footerText, headerLogo, headerColor, footerColor}';
COMMENT ON COLUMN tenants.custom_css IS 'Custom CSS code for white-label customization';
COMMENT ON COLUMN tenants.custom_domains IS 'Array of custom domains: [{domain, type, status, sslStatus, verified}]';




-- Stripe Integration Tables
-- This migration creates tables for managing Stripe customers, subscriptions, and payments

-- Stripe Customers Table (drop and recreate to fix schema)
DROP TABLE IF EXISTS stripe_customers CASCADE;
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  address JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, stripe_customer_id)
);

-- Stripe Subscriptions Table (drop and recreate to fix schema)
DROP TABLE IF EXISTS stripe_subscriptions CASCADE;
CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_price_id TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired', 'paused')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  plan_name TEXT NOT NULL,
  plan_price DECIMAL(10, 2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  currency TEXT NOT NULL DEFAULT 'usd',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe Payment Methods Table (drop and recreate to fix schema)
DROP TABLE IF EXISTS stripe_payment_methods CASCADE;
CREATE TABLE stripe_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('card', 'bank_account', 'us_bank_account', 'sepa_debit')),
  is_default BOOLEAN DEFAULT FALSE,
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  billing_details JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe Invoices Table (drop and recreate to fix schema)
DROP TABLE IF EXISTS stripe_invoices CASCADE;
CREATE TABLE stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_subscription_id TEXT REFERENCES stripe_subscriptions(stripe_subscription_id) ON DELETE SET NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  invoice_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
  amount_due DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  subtotal DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  tax DECIMAL(10, 2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  invoice_pdf TEXT,
  invoice_hosted_url TEXT,
  line_items JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe Payment Intents Table (drop and recreate to fix schema)
DROP TABLE IF EXISTS stripe_payment_intents CASCADE;
CREATE TABLE stripe_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT REFERENCES stripe_customers(stripe_customer_id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL CHECK (status IN ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded')),
  payment_method_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe Webhook Events Table (drop and recreate to fix schema)
DROP TABLE IF EXISTS stripe_webhook_events CASCADE;
CREATE TABLE stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  livemode BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  event_data JSONB NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stripe Products and Prices (drop and recreate to fix schema)
DROP TABLE IF EXISTS stripe_products CASCADE;
DROP TABLE IF EXISTS stripe_prices CASCADE;
CREATE TABLE stripe_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stripe_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT NOT NULL REFERENCES stripe_products(stripe_product_id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  currency TEXT NOT NULL DEFAULT 'usd',
  unit_amount DECIMAL(10, 2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  interval_count INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stripe_customers_tenant_id ON stripe_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_tenant_id ON stripe_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_stripe_id ON stripe_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_tenant_id ON stripe_payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_customer_id ON stripe_payment_methods(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_methods_default ON stripe_payment_methods(tenant_id, is_default) WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_tenant_id ON stripe_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_customer_id ON stripe_invoices(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON stripe_invoices(status);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_stripe_id ON stripe_invoices(stripe_invoice_id);

CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_tenant_id ON stripe_payment_intents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_status ON stripe_payment_intents(status);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_stripe_id ON stripe_payment_intents(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_id ON stripe_webhook_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_prices_product_id ON stripe_prices(stripe_product_id);
CREATE INDEX IF NOT EXISTS idx_stripe_prices_billing_cycle ON stripe_prices(billing_cycle);

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_stripe_customers_updated_at BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_subscriptions_updated_at BEFORE UPDATE ON stripe_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_payment_methods_updated_at BEFORE UPDATE ON stripe_payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_invoices_updated_at BEFORE UPDATE ON stripe_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_payment_intents_updated_at BEFORE UPDATE ON stripe_payment_intents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_products_updated_at BEFORE UPDATE ON stripe_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_prices_updated_at BEFORE UPDATE ON stripe_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Stripe tables
-- Users can only access their own tenant's Stripe data
CREATE POLICY "Users can view their tenant's stripe customers"
  ON stripe_customers FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their tenant's subscriptions"
  ON stripe_subscriptions FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their tenant's payment methods"
  ON stripe_payment_methods FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their tenant's invoices"
  ON stripe_invoices FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their tenant's payment intents"
  ON stripe_payment_intents FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Platform admins can view all Stripe data
CREATE POLICY "Platform admins can view all stripe customers"
  ON stripe_customers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role_id IN (SELECT id FROM roles WHERE name = 'Platform Admin')
      AND users.tenant_id IS NULL
    )
  );

CREATE POLICY "Platform admins can view all subscriptions"
  ON stripe_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role_id IN (SELECT id FROM roles WHERE name = 'Platform Admin')
      AND users.tenant_id IS NULL
    )
  );

-- Webhook events are only accessible by platform admins
CREATE POLICY "Platform admins can view webhook events"
  ON stripe_webhook_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role_id IN (SELECT id FROM roles WHERE name = 'Platform Admin')
      AND users.tenant_id IS NULL
    )
  );

-- Products and prices are viewable by all authenticated users
CREATE POLICY "Authenticated users can view products"
  ON stripe_products FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can view prices"
  ON stripe_prices FOR SELECT
  USING (true);

-- CRM System Tables
-- This migration creates tables for managing contacts, deals, tasks, notes, and activities
-- Based on atomic-crm reference architecture

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies/Organizations Table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  size TEXT CHECK (size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  annual_revenue DECIMAL(15, 2),
  description TEXT,
  address JSONB DEFAULT '{}',
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT companies_tenant_name_unique UNIQUE(tenant_id, name)
);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  job_title TEXT,
  department TEXT,
  address JSONB DEFAULT '{}',
  avatar_url TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create unique index for tenant_id + email (only when email is not null)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_tenant_email_unique 
  ON contacts(tenant_id, email) 
  WHERE email IS NOT NULL;

-- Deal Stages (for Kanban board)
CREATE TABLE IF NOT EXISTS deal_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#6366f1',
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deal_stages_tenant_position_unique UNIQUE(tenant_id, position)
);

-- Deals/Opportunities Table
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  stage_id UUID NOT NULL REFERENCES deal_stages(id) ON DELETE RESTRICT,
  value DECIMAL(15, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  actual_close_date DATE,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMPTZ,
  reminder_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tasks_has_reference CHECK (
    (contact_id IS NOT NULL)::int + 
    (company_id IS NOT NULL)::int + 
    (deal_id IS NOT NULL)::int = 1
  )
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'note' CHECK (type IN ('note', 'email', 'call', 'meeting', 'other')),
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notes_has_reference CHECK (
    (contact_id IS NOT NULL)::int + 
    (company_id IS NOT NULL)::int + 
    (deal_id IS NOT NULL)::int >= 1
  )
);

-- Activities Table (for activity history)
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('created', 'updated', 'deleted', 'note_added', 'task_created', 'task_completed', 'deal_stage_changed', 'email_sent', 'call_made', 'meeting_scheduled')),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_companies_tenant_id ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_created_at ON companies(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_stages_tenant_id ON deal_stages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deal_stages_position ON deal_stages(tenant_id, position);

CREATE INDEX IF NOT EXISTS idx_deals_tenant_id ON deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_date ON tasks(reminder_date);

CREATE INDEX IF NOT EXISTS idx_notes_tenant_id ON notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notes_contact_id ON notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_notes_company_id ON notes(company_id);
CREATE INDEX IF NOT EXISTS idx_notes_deal_id ON notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_tenant_id ON activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Users can view companies in their tenant"
  ON companies FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert companies in their tenant"
  ON companies FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update companies in their tenant"
  ON companies FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete companies in their tenant"
  ON companies FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for contacts
CREATE POLICY "Users can view contacts in their tenant"
  ON contacts FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert contacts in their tenant"
  ON contacts FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update contacts in their tenant"
  ON contacts FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete contacts in their tenant"
  ON contacts FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for deal_stages
CREATE POLICY "Users can view deal_stages in their tenant"
  ON deal_stages FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert deal_stages in their tenant"
  ON deal_stages FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update deal_stages in their tenant"
  ON deal_stages FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete deal_stages in their tenant"
  ON deal_stages FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for deals
CREATE POLICY "Users can view deals in their tenant"
  ON deals FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert deals in their tenant"
  ON deals FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update deals in their tenant"
  ON deals FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete deals in their tenant"
  ON deals FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks in their tenant"
  ON tasks FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert tasks in their tenant"
  ON tasks FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update tasks in their tenant"
  ON tasks FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete tasks in their tenant"
  ON tasks FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for notes
CREATE POLICY "Users can view notes in their tenant"
  ON notes FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert notes in their tenant"
  ON notes FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update notes in their tenant"
  ON notes FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete notes in their tenant"
  ON notes FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- RLS Policies for activities
CREATE POLICY "Users can view activities in their tenant"
  ON activities FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert activities in their tenant"
  ON activities FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Insert default deal stages for each tenant (will be created on tenant creation)
-- This is handled by application logic, not migration
-- Fix RLS recursion in CRM tables
-- The CRM RLS policies were querying the users table directly, causing infinite recursion
-- Solution: Add Platform Admin policies first, then fix regular policies to avoid recursion

-- Drop existing CRM policies
DROP POLICY IF EXISTS "Users can view companies in their tenant" ON companies;
DROP POLICY IF EXISTS "Users can insert companies in their tenant" ON companies;
DROP POLICY IF EXISTS "Users can update companies in their tenant" ON companies;
DROP POLICY IF EXISTS "Users can delete companies in their tenant" ON companies;

DROP POLICY IF EXISTS "Users can view contacts in their tenant" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their tenant" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their tenant" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their tenant" ON contacts;

DROP POLICY IF EXISTS "Users can view deal_stages in their tenant" ON deal_stages;
DROP POLICY IF EXISTS "Users can insert deal_stages in their tenant" ON deal_stages;
DROP POLICY IF EXISTS "Users can update deal_stages in their tenant" ON deal_stages;
DROP POLICY IF EXISTS "Users can delete deal_stages in their tenant" ON deal_stages;

DROP POLICY IF EXISTS "Users can view deals in their tenant" ON deals;
DROP POLICY IF EXISTS "Users can insert deals in their tenant" ON deals;
DROP POLICY IF EXISTS "Users can update deals in their tenant" ON deals;
DROP POLICY IF EXISTS "Users can delete deals in their tenant" ON deals;

DROP POLICY IF EXISTS "Users can view tasks in their tenant" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their tenant" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks in their tenant" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks in their tenant" ON tasks;

DROP POLICY IF EXISTS "Users can view notes in their tenant" ON notes;
DROP POLICY IF EXISTS "Users can insert notes in their tenant" ON notes;
DROP POLICY IF EXISTS "Users can update notes in their tenant" ON notes;
DROP POLICY IF EXISTS "Users can delete notes in their tenant" ON notes;

DROP POLICY IF EXISTS "Users can view activities in their tenant" ON activities;
DROP POLICY IF EXISTS "Users can insert activities in their tenant" ON activities;

-- Create a helper function to get user tenant_id without triggering RLS recursion
-- This function uses SECURITY DEFINER to bypass RLS when querying users table
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tenant_id UUID;
BEGIN
  -- Use SECURITY DEFINER to bypass RLS when querying users table
  SELECT tenant_id INTO user_tenant_id
  FROM users
  WHERE id = auth.uid();
  
  RETURN user_tenant_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tenant_id() TO anon;

-- Companies: Platform Admin policies (allow all operations)
CREATE POLICY "Platform admins can manage all companies"
  ON companies FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Companies: Regular user policies (use helper function to avoid recursion)
CREATE POLICY "Users can view companies in their tenant"
  ON companies FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert companies in their tenant"
  ON companies FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update companies in their tenant"
  ON companies FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete companies in their tenant"
  ON companies FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Contacts: Platform Admin policies
CREATE POLICY "Platform admins can manage all contacts"
  ON contacts FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Contacts: Regular user policies
CREATE POLICY "Users can view contacts in their tenant"
  ON contacts FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert contacts in their tenant"
  ON contacts FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update contacts in their tenant"
  ON contacts FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete contacts in their tenant"
  ON contacts FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Deal Stages: Platform Admin policies
CREATE POLICY "Platform admins can manage all deal_stages"
  ON deal_stages FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Deal Stages: Regular user policies
CREATE POLICY "Users can view deal_stages in their tenant"
  ON deal_stages FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert deal_stages in their tenant"
  ON deal_stages FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update deal_stages in their tenant"
  ON deal_stages FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete deal_stages in their tenant"
  ON deal_stages FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Deals: Platform Admin policies
CREATE POLICY "Platform admins can manage all deals"
  ON deals FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Deals: Regular user policies
CREATE POLICY "Users can view deals in their tenant"
  ON deals FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert deals in their tenant"
  ON deals FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update deals in their tenant"
  ON deals FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete deals in their tenant"
  ON deals FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Tasks: Platform Admin policies
CREATE POLICY "Platform admins can manage all tasks"
  ON tasks FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Tasks: Regular user policies
CREATE POLICY "Users can view tasks in their tenant"
  ON tasks FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert tasks in their tenant"
  ON tasks FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update tasks in their tenant"
  ON tasks FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete tasks in their tenant"
  ON tasks FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Notes: Platform Admin policies
CREATE POLICY "Platform admins can manage all notes"
  ON notes FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Notes: Regular user policies
CREATE POLICY "Users can view notes in their tenant"
  ON notes FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert notes in their tenant"
  ON notes FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update notes in their tenant"
  ON notes FOR UPDATE
  USING (tenant_id = get_user_tenant_id())
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete notes in their tenant"
  ON notes FOR DELETE
  USING (tenant_id = get_user_tenant_id());

-- Activities: Platform Admin policies
CREATE POLICY "Platform admins can manage all activities"
  ON activities FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Activities: Regular user policies
CREATE POLICY "Users can view activities in their tenant"
  ON activities FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert activities in their tenant"
  ON activities FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());
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
