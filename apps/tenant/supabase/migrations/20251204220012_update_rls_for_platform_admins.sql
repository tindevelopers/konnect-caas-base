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

