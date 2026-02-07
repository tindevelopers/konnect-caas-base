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

