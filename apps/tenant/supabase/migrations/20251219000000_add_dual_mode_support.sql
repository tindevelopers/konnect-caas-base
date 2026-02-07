-- Migration: Add Dual-Mode Support for Multi-Tenant and Organization-Only Modes
-- This migration adds support for both multi-tenant mode (tenant → organizations)
-- and organization-only mode (single tenant managing multiple organizations)

-- Add mode column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'multi-tenant' 
  CHECK (mode IN ('multi-tenant', 'organization-only'));

-- Add organization_type to workspaces table
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS organization_type TEXT DEFAULT 'standard'
  CHECK (organization_type IN ('standard', 'franchise', 'location', 'attraction', 'department'));

-- Create platform tenant for organization-only mode
-- This tenant will be used when the system is in organization-only mode
DO $$
DECLARE
  platform_tenant_id UUID;
BEGIN
  -- Check if platform tenant already exists
  SELECT id INTO platform_tenant_id
  FROM tenants
  WHERE domain = 'platform' AND mode = 'organization-only'
  LIMIT 1;

  -- Create platform tenant if it doesn't exist
  IF platform_tenant_id IS NULL THEN
    INSERT INTO tenants (id, name, domain, mode, status, plan, region, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Platform Tenant',
      'platform',
      'organization-only',
      'active',
      'enterprise',
      'global',
      NOW(),
      NOW()
    )
    RETURNING id INTO platform_tenant_id;
  END IF;
END $$;

-- Update RLS policies to support dual mode
-- First, create a helper function to get current tenant mode
CREATE OR REPLACE FUNCTION get_current_tenant_mode()
RETURNS TEXT AS $$
DECLARE
  current_tenant_id UUID;
  tenant_mode TEXT;
BEGIN
  -- Try to get tenant_id from current setting (set by middleware)
  current_tenant_id := current_setting('app.current_tenant_id', true)::UUID;
  
  IF current_tenant_id IS NULL THEN
    -- Try to get from user's tenant_id
    SELECT tenant_id INTO current_tenant_id
    FROM users
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;

  IF current_tenant_id IS NULL THEN
    RETURN 'multi-tenant'; -- Default mode
  END IF;

  -- Get tenant mode
  SELECT mode INTO tenant_mode
  FROM tenants
  WHERE id = current_tenant_id;

  RETURN COALESCE(tenant_mode, 'multi-tenant');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update workspaces RLS policy to support dual mode
DROP POLICY IF EXISTS "Users can view workspaces in their tenant" ON workspaces;
CREATE POLICY "Users can view workspaces in their tenant"
  ON workspaces FOR SELECT
  USING (
    -- Multi-tenant mode: Filter by tenant_id
    (get_current_tenant_mode() = 'multi-tenant' AND tenant_id = get_current_tenant_id())
    OR
    -- Organization-only mode: All organizations visible (filtered by user access)
    (get_current_tenant_mode() = 'organization-only' AND (
      tenant_id IN (
        SELECT tenant_id FROM users WHERE id = auth.uid()
      )
      OR tenant_id = (
        SELECT id FROM tenants WHERE domain = 'platform' AND mode = 'organization-only' LIMIT 1
      )
    ))
    OR
    -- Platform admins can view all
    is_platform_admin()
  );

-- Update workspace_users RLS policy to support dual mode
DROP POLICY IF EXISTS "Users can view workspace users for their workspaces" ON workspace_users;
CREATE POLICY "Users can view workspace users for their workspaces"
  ON workspace_users FOR SELECT
  USING (
    -- Multi-tenant mode: Filter by tenant
    (get_current_tenant_mode() = 'multi-tenant' AND workspace_id IN (
      SELECT id FROM workspaces 
      WHERE tenant_id = get_current_tenant_id()
    ))
    OR
    -- Organization-only mode: Filter by user's organizations
    (get_current_tenant_mode() = 'organization-only' AND workspace_id IN (
      SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
    ))
    OR
    -- Platform admins can view all
    is_platform_admin()
  );

-- Add index for mode column for better query performance
CREATE INDEX IF NOT EXISTS idx_tenants_mode ON tenants(mode);
CREATE INDEX IF NOT EXISTS idx_workspaces_organization_type ON workspaces(organization_type);

-- Add comment to document the dual-mode feature
COMMENT ON COLUMN tenants.mode IS 'System mode: multi-tenant (tenant → organizations) or organization-only (single tenant managing organizations)';
COMMENT ON COLUMN workspaces.organization_type IS 'Type of organization: standard, franchise, location, attraction, or department';
