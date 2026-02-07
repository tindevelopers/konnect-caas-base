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

