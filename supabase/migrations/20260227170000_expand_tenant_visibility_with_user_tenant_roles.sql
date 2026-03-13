-- Allow tenant-scoped users to view tenants where they have explicit role assignments.
-- This supports multi-role users who can access more than one tenant via user_tenant_roles.

DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;

CREATE POLICY "Users can view their own tenant"
  ON tenants FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Primary tenant assigned on users table
      id IN (
        SELECT u.tenant_id
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.tenant_id IS NOT NULL
      )
      OR
      -- Explicit tenant access through user_tenant_roles
      EXISTS (
        SELECT 1
        FROM public.user_tenant_roles utr
        WHERE utr.user_id = auth.uid()
          AND utr.tenant_id = tenants.id
      )
      OR
      -- Platform Admins retain full tenant visibility
      EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.roles r ON u.role_id = r.id
        WHERE u.id = auth.uid()
          AND r.name = 'Platform Admin'
          AND u.tenant_id IS NULL
      )
    )
  );
