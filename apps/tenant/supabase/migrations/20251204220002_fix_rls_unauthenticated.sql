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

